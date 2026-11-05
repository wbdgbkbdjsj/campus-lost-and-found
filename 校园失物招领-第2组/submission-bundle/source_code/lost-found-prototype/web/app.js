/* 校园失物招领与认领审核系统 · 前端演示页
 * Vue 3 global build（本地 vendor，零构建、断网可跑）
 * 唯一口径：api-contract-v1.md（student / reviewer / super_admin，9 表，8 态状态机）
 *
 * 设计约束（任务卡 §4 / §5）：
 *  1. 审核按钮显隐一律取自后端返回的 allowed_events，前端不重写状态迁移规则；
 *     唯一例外是 VERIFY —— 它是 APPROVED 自环、不进迁移表，后端 allowed_events
 *     天然不含它，故核验「入口」按状态显示，但不参与任何迁移裁决。
 *  2. 后端错误体为 {code, message, detail}：message 是英文枚举（如 VALIDATION_ERROR），
 *     中文原因在 detail。页面把 code + message + detail 原样并列显示，
 *     因此「未核验点交接」会红字显示 40003 与「交接前必须先通过身份核验…」。
 *  3. 状态码与中文名并列显示；中文名仅作展示文案，不参与判断。
 *  4. C 端后台管理端按契约 #25-30 实现（用户/字典/统计/日志），原型内可直接演示管理员权限最多。
 */
(function () {
  'use strict';

  var createApp = Vue.createApp;
  var API = '/api/v1';
  var TOKEN_KEY = 'lf_token';

  // ---- 仅用于展示的文案映射（与 state_machine.py 的 STATES / EVENTS 保持一致，不参与裁决）----
  var CLAIM_STATUS_TEXT = {
    SUBMITTED: '待审核', UNDER_REVIEW: '审核中', PENDING_INFO: '待补充材料',
    APPROVED: '审核通过·待领取', REJECTED: '已驳回', CANCELLED: '已撤销',
    COMPLETED: '已完成', EXPIRED: '已失效'
  };
  var ITEM_STATUS_TEXT = {
    REGISTERED: '已登记·可认领', CLAIMING: '认领中', PICKUP_PENDING: '待领取',
    CLAIMED: '已认领', CLOSED: '已关闭'
  };
  var EVENT_TEXT = {
    ACCEPT: '审核员接单', VERIFY: '身份核验（自环，不改状态）', APPROVE: '审核通过',
    REJECT: '驳回', REQUEST_INFO: '退回补充材料', RESUBMIT: '补充材料',
    HANDOVER: '确认交接', CANCEL: '撤销申请', EXPIRE: '超时失效（系统）'
  };
  var ROLE_TEXT = { student: '学生（A 端）', reviewer: '审核员（B 端）', super_admin: '超级管理员（C 端）' };
  var REVIEWER_EVENTS = ['ACCEPT', 'APPROVE', 'REJECT', 'REQUEST_INFO', 'HANDOVER'];
  var STUDENT_EVENTS = ['CANCEL', 'RESUBMIT'];

  // 统一请求：成功返回完整 payload {code, message, data}；失败抛出带 code/messageEn/detail 的 Error
  async function request(path, opts, token) {
    var o = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var resp;
    try {
      resp = await fetch(API + path, {
        method: o.method || 'GET',
        headers: headers,
        body: o.body === undefined ? undefined : JSON.stringify(o.body)
      });
    } catch (e) {
      var ne = new Error('网络请求失败');
      ne.code = 'NETWORK'; ne.messageEn = 'NETWORK_ERROR';
      ne.detail = '无法连接后端。请确认已在 05_源码/ 下执行 uvicorn main:app --reload，并通过 http://127.0.0.1:8000/ 访问。';
      throw ne;
    }
    var payload;
    try { payload = await resp.json(); }
    catch (e) {
      var pe = new Error('响应解析失败');
      pe.code = resp.status; pe.messageEn = 'BAD_RESPONSE';
      pe.detail = 'HTTP ' + resp.status + '，返回内容不是 JSON。';
      throw pe;
    }
    if (payload.code !== 0) {
      var de = new Error(payload.detail || payload.message);
      de.code = payload.code;
      de.messageEn = payload.message;
      de.detail = payload.detail || payload.message;
      throw de;
    }
    return payload;
  }

  function defaultView(role) {
    if (role === 'reviewer') return 'queue';
    if (role === 'super_admin') return 'backend';
    return 'foundList';
  }

  createApp({
    data: function () {
      return {
        token: localStorage.getItem(TOKEN_KEY) || '',
        user: null,
        view: 'login',
        loading: false,
        error: null,      // {code, message, detail} —— 后端错误原样呈现
        notice: null,     // 成功提示
        // 登录
        loginForm: { student_no: '', password: '123456' },
        // 字典
        categories: [], locations: [],
        // A · 招领
        keyword: '', items: [], itemsTotal: 0, page: 1, size: 10,
        itemDetail: null,
        foundForm: { title: '', category_id: '', description: '', found_location: '', storage_location: '' },
        claimForm: { found_item_id: '', description: '', proof: '', contact: '' },
        myClaims: [],
        // B · 审核
        queue: [],
        claimId: null, claim: null,
        openIdInput: '',
        actionComment: '', supplementProof: '',
        verifyForm: { student_no: '', name: '' }, verifyResult: null,
        notifications: [],
        // C · 后台管理（管理员权限最多）
        adminStats: null,
        adminUsers: [], userKeyword: '',
        adminCategories: [], catForm: { name: '', sort_order: 0 },
        adminLocations: [], locForm: { name: '', sort_order: 0 },
        adminLogs: [], logEntity: ''
      };
    },

    computed: {
      roleLabel: function () { return this.user ? (ROLE_TEXT[this.user.role] || this.user.role) : ''; },
      menus: function () {
        if (!this.user) return [];
        if (this.user.role === 'student') return [
          { key: 'foundList', label: '招领列表 / 搜索', step: '演示步 4' },
          { key: 'foundNew', label: '拾获登记', step: '演示步 2' },
          { key: 'foundDetail', label: '物品详情', step: '演示步 5' },
          { key: 'claimCreate', label: '认领申请', step: '演示步 6' },
          { key: 'myClaims', label: '我的认领单', step: '演示步 7 / 14' },
          { key: 'notifications', label: '流水与通知', step: '演示步 15' }
        ];
        if (this.user.role === 'reviewer') return [
          { key: 'queue', label: '审核队列', step: '演示步 8' },
          { key: 'claimDetail', label: '认领单详情', step: '演示步 9 / 10 / 11' },
          { key: 'verify', label: '身份核验', step: '演示步 12' },
          { key: 'handover', label: '交接确认', step: '演示步 13' },
          { key: 'notifications', label: '流水与通知', step: '演示步 15' }
        ];
        return [
          { key: 'adminDashboard', label: '数据看板', step: '契约 #29' },
          { key: 'adminUsers', label: '用户管理', step: '契约 #25-26' },
          { key: 'adminCategories', label: '分类字典维护', step: '契约 #27' },
          { key: 'adminLocations', label: '地点字典维护', step: '契约 #28' },
          { key: 'adminLogs', label: '操作日志', step: '契约 #30' }
        ];
      },
      allowed: function () {
        return (this.claim && this.claim.allowed_events) ? this.claim.allowed_events : [];
      },
      // 按钮集合直接由后端 allowed_events 推导；此处只按登录角色过滤可见事件，不重写迁移规则
      reviewerButtons: function () {
        if (!this.user || this.user.role !== 'reviewer') return [];
        return this.allowed.filter(function (e) { return REVIEWER_EVENTS.indexOf(e) >= 0; });
      },
      studentButtons: function () {
        if (!this.user || this.user.role !== 'student') return [];
        return this.allowed.filter(function (e) { return STUDENT_EVENTS.indexOf(e) >= 0; });
      },
      // VERIFY 是 APPROVED 自环、不进迁移表，后端 allowed_events 不含它；
      // 这里只控制「入口是否出现」，状态能否迁移仍完全由后端裁决。
      showVerifyEntry: function () {
        return !!(this.claim && this.claim.status === 'APPROVED' && this.user && this.user.role === 'reviewer');
      },
      showHandoverEntry: function () {
        return !!(this.claim && this.allowed.indexOf('HANDOVER') >= 0 && this.user && this.user.role === 'reviewer');
      },
      hasVerifyPassed: function () {
        if (!this.claim || !this.claim.records) return false;
        return this.claim.records.some(function (r) {
          return r.action === 'VERIFY' && (r.comment || '').indexOf('核验通过') === 0;
        });
      }
    },

    mounted: async function () {
      if (!this.token) return;
      var d = await this.call('/auth/me');
      if (!d) { this.logout(); return; }
      this.user = { id: d.id, student_no: d.student_no, name: d.name, role: d.role };
      await this.loadDict();
      this.go(defaultView(d.role));
    },

    methods: {
      // ---------- 基础设施 ----------
      claimStatus: function (s) { return CLAIM_STATUS_TEXT[s] || s; },
      itemStatus: function (s) { return ITEM_STATUS_TEXT[s] || s; },
      eventText: function (e) { return EVENT_TEXT[e] || e; },
      show: function (v) { return v === null || v === undefined || v === '' ? '—' : v; },

      tagClass: function (s) {
        if (s === 'APPROVED' || s === 'PICKUP_PENDING') return 'tag-green';
        if (s === 'COMPLETED' || s === 'CLAIMED') return 'tag-blue';
        if (s === 'REJECTED' || s === 'CANCELLED' || s === 'EXPIRED') return 'tag-red';
        if (s === 'PENDING_INFO' || s === 'CLAIMING') return 'tag-amber';
        return 'tag-gray';
      },

      setFrontError: function (detail) {
        this.error = { code: 'FRONT', message: 'FRONTEND_VALIDATION', detail: detail };
      },

      // 所有接口统一走这里：错误体原样落到页面，不做静默吞掉
      call: async function (path, opts) {
        this.loading = true;
        this.error = null;
        this.notice = null;
        try {
          var r = await request(path, opts, this.token);
          return r.data;
        } catch (e) {
          this.error = {
            code: e.code,
            message: e.messageEn || e.message,
            detail: e.detail || e.message
          };
          return null;
        } finally {
          this.loading = false;
        }
      },

      go: async function (view, notice) {
        this.error = null;
        this.notice = null;
        this.view = view;
        if (view === 'foundList') await this.searchItems(1);
        else if (view === 'foundNew') await this.loadDict();
        else if (view === 'claimCreate') await this.loadDict();
        else if (view === 'myClaims') await this.loadMyClaims();
        else if (view === 'queue') await this.loadQueue();
        else if (view === 'notifications') await this.loadNotifications();
        else if (view === 'adminDashboard') await this.loadAdminStats();
        else if (view === 'adminUsers') await this.loadAdminUsers();
        else if (view === 'adminCategories') await this.loadAdminCategories();
        else if (view === 'adminLocations') await this.loadAdminLocations();
        else if (view === 'adminLogs') await this.loadAdminLogs();
        else if (view === 'claimDetail' || view === 'verify' || view === 'handover') {
          if (this.claimId) await this.loadClaim(this.claimId);
        }
        if (notice) this.notice = notice;
      },

      loadDict: async function () {
        try {
          var r = await Promise.all([
            request('/dict/categories', {}, this.token),
            request('/dict/locations', {}, this.token)
          ]);
          this.categories = r[0].data;
          this.locations = r[1].data;
          if (!this.foundForm.category_id && this.categories.length) {
            this.foundForm.category_id = this.categories[0].id;
          }
          if (!this.foundForm.found_location && this.locations.length) {
            this.foundForm.found_location = this.locations[0].name;
          }
        } catch (e) {
          this.error = { code: e.code, message: e.messageEn || e.message, detail: e.detail || e.message };
        }
      },

      // ---------- 认证 ----------
      fillSeed: function (no) { this.loginForm.student_no = no; this.loginForm.password = '123456'; },

      login: async function () {
        if (!this.loginForm.student_no.trim()) { this.setFrontError('请输入学号'); return; }
        var d = await this.call('/auth/login', {
          method: 'POST',
          body: { student_no: this.loginForm.student_no.trim(), password: this.loginForm.password }
        });
        if (!d) return;
        this.token = d.token;
        this.user = d.user;
        localStorage.setItem(TOKEN_KEY, d.token);
        await this.loadDict();
        this.go(defaultView(d.user.role),
          '登录成功：' + d.user.name + ' / ' + d.user.role + '，已按角色加载菜单');
      },

      logout: function () {
        localStorage.removeItem(TOKEN_KEY);
        this.token = ''; this.user = null; this.claim = null; this.claimId = null;
        this.error = null; this.notice = null;
        this.view = 'login';
      },

      // ---------- A · 物品 ----------
      searchItems: async function (p) {
        this.page = p || 1;
        var q = '?keyword=' + encodeURIComponent(this.keyword) +
                '&page=' + this.page + '&size=' + this.size;
        var d = await this.call('/found-items' + q);
        if (d) { this.items = d.items; this.itemsTotal = d.total; }
      },

      openItem: async function (id) {
        var d = await this.call('/found-items/' + id);
        if (d) { this.itemDetail = d; this.view = 'foundDetail'; }
      },

      submitFound: async function () {
        if (!this.foundForm.title.trim()) { this.setFrontError('物品名称不能为空'); return; }
        var d = await this.call('/found-items', {
          method: 'POST',
          body: {
            title: this.foundForm.title.trim(),
            category_id: Number(this.foundForm.category_id) || 1,
            description: this.foundForm.description,
            found_location: this.foundForm.found_location,
            storage_location: this.foundForm.storage_location
          }
        });
        if (d) {
          this.foundForm = { title: '', category_id: this.categories.length ? this.categories[0].id : '',
                             description: '', found_location: '', storage_location: '' };
          this.go('foundList', '拾获登记成功：物品 #' + d.id + '，状态 ' + d.status + '（' + this.itemStatus(d.status) + '）');
        }
      },

      openClaimCreate: function (itemId) {
        this.claimForm.found_item_id = itemId || this.claimForm.found_item_id;
        this.claimForm.description = ''; this.claimForm.proof = ''; this.claimForm.contact = '';
        this.go('claimCreate');
      },

      submitClaim: async function () {
        // 防冒领第一关：proof 必填，前端先拦一次（后端同样会校验）
        if (!this.claimForm.proof.trim()) {
          this.setFrontError('凭证(proof)不能为空：请填写能证明物品归属的特征，这是防冒领第一关');
          return;
        }
        if (!this.claimForm.found_item_id) { this.setFrontError('请先选择要认领的物品'); return; }
        var d = await this.call('/claims', {
          method: 'POST',
          body: {
            found_item_id: Number(this.claimForm.found_item_id),
            description: this.claimForm.description,
            proof: this.claimForm.proof,
            contact: this.claimForm.contact
          }
        });
        if (d) {
          this.claimId = d.id;
          this.go('myClaims', '认领申请已提交：认领单 #' + d.id + '，状态 ' + d.status + '（' + this.claimStatus(d.status) + '）');
        }
      },

      loadMyClaims: async function () {
        var d = await this.call('/claims?scope=mine');
        if (d) this.myClaims = d.items;
      },

      // ---------- B · 审核 ----------
      loadQueue: async function () {
        var d = await this.call('/review/queue');
        if (d) this.queue = d.items;
      },

      loadClaim: async function (id) {
        var d = await this.call('/claims/' + id);
        if (d) this.claim = d;
      },

      openClaim: async function (id) {
        this.claimId = id;
        this.openIdInput = String(id);
        this.verifyResult = null;
        this.actionComment = '';
        await this.loadClaim(id);
        this.view = 'claimDetail';
      },

      openClaimByInput: function () {
        var id = Number(this.openIdInput);
        if (!id) { this.setFrontError('请输入认领单 ID（可从审核队列或我的认领单中点选）'); return; }
        this.openClaim(id);
      },

      doReview: async function (event) {
        if (!this.claimId) { this.setFrontError('请先选择一张认领单'); return; }
        var id = this.claimId;
        var map = {
          ACCEPT: '/review/claims/' + id + '/accept',
          APPROVE: '/review/claims/' + id + '/approve',
          REJECT: '/review/claims/' + id + '/reject',
          REQUEST_INFO: '/review/claims/' + id + '/request-info',
          HANDOVER: '/review/claims/' + id + '/handover',
          CANCEL: '/review/claims/' + id + '/cancel'
        };
        if (!map[event]) return;
        var d = await this.call(map[event], {
          method: 'POST', body: { comment: this.actionComment }
        });
        if (d) {
          await this.loadClaim(id);   // 刷新 records，才能看到 VERIFY 自环流水
          this.notice = '事件 ' + event + '（' + this.eventText(event) + '）执行成功；当前状态 ' +
                        d.status + '（' + this.claimStatus(d.status) + '）';
          this.actionComment = '';
        }
      },

      submitSupplement: async function () {
        if (!this.supplementProof.trim()) { this.setFrontError('补充材料(proof)不能为空'); return; }
        var d = await this.call('/claims/' + this.claimId + '/supplement', {
          method: 'POST', body: { proof: this.supplementProof }
        });
        if (d) {
          await this.loadClaim(this.claimId);
          this.notice = '材料已补充，重新进入审核：' + d.status + '（' + this.claimStatus(d.status) + '）';
          this.supplementProof = '';
        }
      },

      fillVerifySeed: function () {
        this.verifyForm.student_no = 'stu001';
        this.verifyForm.name = '王小明';
      },

      submitVerify: async function () {
        if (!this.claimId) { this.setFrontError('请先选择一张认领单'); return; }
        if (!this.verifyForm.student_no.trim() || !this.verifyForm.name.trim()) {
          this.setFrontError('请输入到场人学号与姓名');
          return;
        }
        var d = await this.call('/review/claims/' + this.claimId + '/verify', {
          method: 'POST',
          body: { student_no: this.verifyForm.student_no.trim(), name: this.verifyForm.name.trim() }
        });
        if (d) {
          this.verifyResult = d;
          await this.loadClaim(this.claimId);
          this.notice = '状态不变，已写 VERIFY 流水（' + (d.verified ? '核验通过' : '核验不通过') + '）';
        }
      },

      doHandover: async function () {
        if (!this.claimId) { this.setFrontError('请先选择一张认领单'); return; }
        // 注意：按钮不禁用、前端不预判 I7，让后端 40003 原样呈现，这是现场演示点
        var d = await this.call('/review/claims/' + this.claimId + '/handover', {
          method: 'POST', body: { comment: this.actionComment }
        });
        if (d) {
          await this.loadClaim(this.claimId);
          this.notice = '交接完成：认领单 ' + d.status + '（' + this.claimStatus(d.status) +
                        '），物品已置为 CLAIMED（已认领）';
        }
      },

      loadNotifications: async function () {
        var d = await this.call('/notifications');
        if (d) this.notifications = d.items;
        if (this.claimId) await this.loadClaim(this.claimId);
      },

      // ---------- C · 后台管理（契约 #25-30，管理员权限最多） ----------
      loadAdminStats: async function () {
        var d = await this.call('/admin/stats/overview');
        if (d) this.adminStats = d;
      },

      loadAdminUsers: async function () {
        var q = '?keyword=' + encodeURIComponent(this.userKeyword) + '&page=1&size=50';
        var d = await this.call('/admin/users' + q);
        if (d) this.adminUsers = d.items;
      },

      setUserStatus: async function (u, status) {
        var d = await this.call('/admin/users/' + u.id + '/status', {
          method: 'PUT', body: { status: status }
        });
        if (d) {
          u.status = d.status;
          this.notice = '账号 ' + u.student_no + ' 已' + (status === 'DISABLED' ? '停用' : '启用');
        }
      },

      loadAdminCategories: async function () {
        var d = await this.call('/admin/dict/categories');
        if (d) this.adminCategories = d;
      },

      addCategory: async function () {
        if (!this.catForm.name.trim()) { this.setFrontError('分类名称不能为空'); return; }
        var d = await this.call('/admin/dict/categories', {
          method: 'POST',
          body: { name: this.catForm.name.trim(), sort_order: Number(this.catForm.sort_order) || 0 }
        });
        if (d) {
          this.catForm = { name: '', sort_order: 0 };
          await this.loadAdminCategories();
          this.notice = '分类已新增：' + d.name;
        }
      },

      loadAdminLocations: async function () {
        var d = await this.call('/admin/dict/locations');
        if (d) this.adminLocations = d;
      },

      addLocation: async function () {
        if (!this.locForm.name.trim()) { this.setFrontError('地点名称不能为空'); return; }
        var d = await this.call('/admin/dict/locations', {
          method: 'POST',
          body: { name: this.locForm.name.trim(), sort_order: Number(this.locForm.sort_order) || 0 }
        });
        if (d) {
          this.locForm = { name: '', sort_order: 0 };
          await this.loadAdminLocations();
          this.notice = '地点已新增：' + d.name;
        }
      },

      loadAdminLogs: async function () {
        var q = this.logEntity ? '?entity=' + encodeURIComponent(this.logEntity) : '';
        var d = await this.call('/admin/audit-logs' + q);
        if (d) this.adminLogs = d.items;
      },

      exportClaims: async function () {
        try {
          var resp = await fetch(API + '/admin/export/claims.csv', {
            headers: { 'Authorization': 'Bearer ' + this.token }
          });
          if (!resp.ok) {
            this.error = { code: resp.status, message: 'EXPORT_FAILED', detail: '导出失败：HTTP ' + resp.status };
            return;
          }
          var blob = await resp.blob();
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url; a.download = 'claims.csv';
          document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(url);
          this.notice = '认领单已导出为 CSV';
        } catch (e) {
          this.error = { code: 'NETWORK', message: 'EXPORT_FAILED', detail: e.message };
        }
      }
    },

    template: `
<div>
  <!-- ================= 顶栏 ================= -->
  <div class="topbar">
    <div>
      <h1>校园失物招领与认领审核系统 <span class="ver">演示页 · 契约 v1 · Vue3 零构建</span></h1>
    </div>
    <div class="who" v-if="user">
      <span><strong>{{ user.name }}</strong> · {{ user.student_no }}</span>
      <span class="badge-role">{{ roleLabel }}</span>
      <button class="btn ghost" style="padding:5px 12px" @click="logout">退出</button>
    </div>
    <div class="who" v-else><span class="badge-role">未登录</span></div>
  </div>

  <!-- ================= 登录页（演示步 1 / 8） ================= -->
  <div class="login-wrap" v-if="!user">
    <div class="login-box">
      <h2>登录</h2>
      <p class="sub">四个种子账号，口令均为 123456。登录后按 <span class="mono">data.user.role</span> 切换三端菜单。</p>

      <div class="alert alert-error" v-if="error">
        <strong>后端返回 {{ error.code }} · {{ error.message }}</strong>
        <div class="detail">{{ error.detail }}</div>
      </div>

      <div class="field" style="margin-bottom:14px">
        <label class="req">学号</label>
        <input v-model="loginForm.student_no" placeholder="如 stu001" @keyup.enter="login">
      </div>
      <div class="field">
        <label class="req">口令</label>
        <input v-model="loginForm.password" type="password" @keyup.enter="login">
      </div>
      <button class="btn" @click="login" :disabled="loading">{{ loading ? '登录中…' : '登 录' }}</button>

      <div class="seed">
        <div class="small muted">种子账号（一键填入，均为演示用虚构数据）</div>
        <div class="row">
          <button @click="fillSeed('stu001')">stu001 学生 A 端</button>
          <button @click="fillSeed('stu002')">stu002 学生 A 端</button>
          <button @click="fillSeed('reviewer001')">reviewer001 审核 B 端</button>
          <button @click="fillSeed('super001')">super001 C 端管理</button>
        </div>
        <div class="small muted" style="margin-top:12px">
          角色值只有 <span class="mono">student / reviewer / super_admin</span>，<span class="mono">admin</span> 已废弃。
        </div>
      </div>
    </div>
  </div>

  <!-- ================= 主界面 ================= -->
  <div class="layout" v-else>
    <div class="sidebar">
      <div class="grp">功能导航</div>
      <button v-for="m in menus" :key="m.key" :class="{ on: view === m.key }" @click="go(m.key)">
        {{ m.label }}<span class="step">{{ m.step }}</span>
      </button>
      <div class="tip">
        主链顺序：<br>提交 → 接单 → 审核通过 → 身份核验 → 交接<br>
        <span class="small">核验为 APPROVED 自环、不改状态；交接强制校验 I7。</span>
      </div>
    </div>

    <div class="main">
      <!-- 全局提示 -->
      <div class="alert alert-error" v-if="error">
        <strong>后端返回 {{ error.code }} · {{ error.message }}</strong>
        <div class="detail">{{ error.detail }}</div>
      </div>
      <div class="alert alert-ok" v-if="notice">{{ notice }}</div>
      <div class="alert alert-info" v-if="loading">正在请求后端…</div>

      <!-- ============ 1. A · 招领列表 / 搜索（演示步 4） ============ -->
      <section v-if="view === 'foundList'">
        <h2>招领列表 / 关键词检索</h2>
        <p class="sub">演示步 4 · <span class="mono">GET /found-items?keyword=&amp;page=&amp;size=</span> · 状态码与中文名并列显示</p>
        <div class="card">
          <div class="btn-row" style="margin-top:0">
            <input v-model="keyword" placeholder="按物品名称检索，如：伞 / 校园卡 / 耳机" style="flex:1;min-width:260px;border:1px solid #bcc7d6;border-radius:5px;padding:9px 11px" @keyup.enter="searchItems(1)">
            <button class="btn" @click="searchItems(1)">检索</button>
            <button class="btn gray" @click="keyword='';searchItems(1)">清空</button>
          </div>
        </div>
        <div class="table-wrap" v-if="items.length">
          <table>
            <thead><tr><th>ID</th><th>物品名称</th><th>分类</th><th>拾获地点</th><th>状态</th><th>保管点</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="i in items" :key="i.id">
                <td>#{{ i.id }}</td>
                <td><strong>{{ i.title }}</strong><div class="small muted">{{ show(i.description) }}</div></td>
                <td>{{ (categories.find(c => c.id === i.category_id) || {}).name || ('#' + i.category_id) }}</td>
                <td>{{ show(i.found_location) }}</td>
                <td><span class="tag" :class="tagClass(i.status)">{{ i.status }}（{{ itemStatus(i.status) }}）</span></td>
                <td>{{ show(i.storage_location) }}</td>
                <td class="nowrap">
                  <button class="btn ghost" style="padding:5px 10px" @click="openItem(i.id)">详情</button>
                  <button class="btn" style="padding:5px 10px" @click="openClaimCreate(i.id)">认领</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>暂无物品。可先在「拾获登记」新增一条，或清空检索条件。</div>
        <div class="btn-row" v-if="items.length">
          <span class="muted small">共 {{ itemsTotal }} 条 · 第 {{ page }} 页</span>
          <button class="btn gray" :disabled="page <= 1" @click="searchItems(page - 1)">上一页</button>
          <button class="btn gray" :disabled="page * size >= itemsTotal" @click="searchItems(page + 1)">下一页</button>
        </div>
      </section>

      <!-- ============ 2. A · 拾获登记（演示步 2） ============ -->
      <section v-if="view === 'foundNew'">
        <h2>拾获登记</h2>
        <p class="sub">演示步 2 · <span class="mono">GET /dict/categories</span>、<span class="mono">/dict/locations</span>、<span class="mono">POST /found-items</span> · 下拉取自字典接口，不写死</p>
        <div class="card">
          <div class="grid">
            <div class="field"><label class="req">物品名称</label><input v-model="foundForm.title" placeholder="如：黑色雨伞"></div>
            <div class="field"><label>分类（字典）</label>
              <select v-model="foundForm.category_id"><option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}（#{{ c.id }}）</option></select>
            </div>
            <div class="field"><label>拾获地点（字典）</label>
              <select v-model="foundForm.found_location"><option v-for="l in locations" :key="l.id" :value="l.name">{{ l.name }}</option></select>
            </div>
            <div class="field"><label>保管点</label><input v-model="foundForm.storage_location" placeholder="如：失物招领处 B12 柜"></div>
          </div>
          <div class="field" style="margin-top:14px"><label>特征描述</label><textarea v-model="foundForm.description" placeholder="外观、划痕、刻字等可核对特征"></textarea></div>
          <div class="btn-row"><button class="btn" @click="submitFound">提交登记</button></div>
        </div>
      </section>

      <!-- ============ 3. A · 物品详情（演示步 5） ============ -->
      <section v-if="view === 'foundDetail'">
        <h2>物品详情</h2>
        <p class="sub">演示步 5 · <span class="mono">GET /found-items/{id}</span></p>
        <div class="card" v-if="itemDetail">
          <h3>#{{ itemDetail.id }} {{ itemDetail.title }}</h3>
          <dl class="kv">
            <dt>状态</dt><dd><span class="tag" :class="tagClass(itemDetail.status)">{{ itemDetail.status }}（{{ itemStatus(itemDetail.status) }}）</span></dd>
            <dt>分类</dt><dd>{{ (categories.find(c => c.id === itemDetail.category_id) || {}).name || ('#' + itemDetail.category_id) }}</dd>
            <dt>拾获地点</dt><dd>{{ show(itemDetail.found_location) }}</dd>
            <dt>拾获时间</dt><dd>{{ show(itemDetail.found_time) }}</dd>
            <dt>保管点</dt><dd>{{ show(itemDetail.storage_location) }}</dd>
            <dt>特征描述</dt><dd>{{ show(itemDetail.description) }}</dd>
          </dl>
          <div class="btn-row">
            <button class="btn" @click="openClaimCreate(itemDetail.id)">发起认领申请 →</button>
            <button class="btn gray" @click="go('foundList')">返回列表</button>
          </div>
        </div>
        <div class="empty" v-else>请先在「招领列表」点「详情」，或
          <button class="btn ghost" style="padding:4px 10px" @click="openItem(1)">打开物品 #1</button>
        </div>
      </section>

      <!-- ============ 4. A · 认领申请（演示步 6） ============ -->
      <section v-if="view === 'claimCreate'">
        <h2>认领申请</h2>
        <p class="sub">演示步 6 · <span class="mono">POST /claims</span> · 凭证 proof 必填，前端先拦一次（防冒领第一关）</p>
        <div class="card">
          <div class="grid">
            <div class="field"><label class="req">物品 ID</label><input v-model.number="claimForm.found_item_id" type="number" min="1"></div>
            <div class="field"><label>联系方式</label><input v-model="claimForm.contact" placeholder="选填"></div>
          </div>
          <div class="field" style="margin-top:14px"><label>丢失经过</label><textarea v-model="claimForm.description" placeholder="何时何地丢失"></textarea></div>
          <div class="field" style="margin-top:14px"><label class="req">归属凭证 proof</label><textarea v-model="claimForm.proof" placeholder="能证明物品归属的特征，如：伞柄有白色划痕、卡号后四位 8821"></textarea></div>
          <div class="alert alert-amber" style="margin-top:14px;margin-bottom:0">proof 为空时前端直接拦截，不向后端发请求；后端同样会做校验。</div>
          <div class="btn-row"><button class="btn" @click="submitClaim">提交认领申请</button></div>
        </div>
      </section>

      <!-- ============ 5. A · 我的认领单（演示步 7 / 14） ============ -->
      <section v-if="view === 'myClaims'">
        <h2>我的认领单</h2>
        <p class="sub">演示步 7 / 14 · <span class="mono">GET /claims?scope=mine</span> · 点「查看流水」回放 records</p>
        <div class="table-wrap" v-if="myClaims.length">
          <table>
            <thead><tr><th>认领单</th><th>物品 ID</th><th>状态</th><th>可执行事件（后端）</th><th>提交时间</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="c in myClaims" :key="c.id">
                <td>#{{ c.id }}</td><td>#{{ c.found_item_id }}</td>
                <td><span class="tag" :class="tagClass(c.status)">{{ c.status }}（{{ claimStatus(c.status) }}）</span></td>
                <td class="code">{{ c.allowed_events.join(', ') || '无（终态）' }}</td>
                <td class="small">{{ show(c.submitted_at) }}</td>
                <td><button class="btn ghost" style="padding:5px 10px" @click="openClaim(c.id)">查看流水</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>暂无认领单。可先在「招领列表」对某件物品点「认领」。</div>
      </section>

      <!-- ============ 6. B · 审核队列（演示步 8） ============ -->
      <section v-if="view === 'queue'">
        <h2>审核队列</h2>
        <p class="sub">演示步 8 · <span class="mono">GET /review/queue</span> · 按提交时间升序（后端已排好）</p>
        <div class="table-wrap" v-if="queue.length">
          <table>
            <thead><tr><th>认领单</th><th>物品</th><th>申请人</th><th>等待</th><th>状态</th><th>可执行事件</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="c in queue" :key="c.id">
                <td>#{{ c.id }}</td><td>{{ c.title }}</td><td>{{ c.applicant }}</td>
                <td>{{ c.waiting_minutes }} 分钟</td>
                <td><span class="tag" :class="tagClass(c.status)">{{ c.status }}（{{ claimStatus(c.status) }}）</span></td>
                <td class="code">{{ c.allowed_events.join(', ') }}</td>
                <td><button class="btn" style="padding:5px 10px" @click="openClaim(c.id)">处理</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>队列为空（当前没有 SUBMITTED / PENDING_INFO 的认领单）。可让学生端新提交一张，或按 ID 打开已有认领单。</div>
        <div class="card" style="margin-top:20px">
          <div class="btn-row" style="margin-top:0">
            <input v-model="openIdInput" placeholder="按认领单 ID 打开，如 1 / 2 / 3" style="width:280px;border:1px solid #bcc7d6;border-radius:5px;padding:9px 11px" @keyup.enter="openClaimByInput">
            <button class="btn ghost" @click="openClaimByInput">打开认领单</button>
            <button class="btn gray" @click="loadQueue">刷新队列</button>
          </div>
        </div>
      </section>

      <!-- ============ 7. B · 认领单详情（演示步 9 / 10 / 11） ============ -->
      <section v-if="view === 'claimDetail'">
        <h2>认领单详情 <span class="code" v-if="claim">#{{ claim.id }}</span></h2>
        <p class="sub">演示步 9 / 10 / 11 · 按钮显隐直接取后端 <span class="mono">allowed_events</span>，前端不重写状态机</p>

        <div class="card">
          <div class="btn-row" style="margin-top:0">
            <input v-model="openIdInput" placeholder="认领单 ID" style="width:200px;border:1px solid #bcc7d6;border-radius:5px;padding:8px 11px" @keyup.enter="openClaimByInput">
            <button class="btn ghost" @click="openClaimByInput">打开</button>
            <button class="btn gray" @click="claimId && loadClaim(claimId)">刷新详情</button>
          </div>
        </div>

        <div v-if="claim">
          <div class="card">
            <h3>当前状态：<span class="tag" :class="tagClass(claim.status)">{{ claim.status }}（{{ claim.status_text }}）</span></h3>
            <div class="code small">allowed_events（后端返回）: [ {{ claim.allowed_events.join(', ') || '无（终态）' }} ]</div>
            <hr>
            <dl class="kv">
              <dt>物品 ID</dt><dd>#{{ claim.found_item_id }}</dd>
              <dt>归属凭证</dt><dd>{{ show(claim.proof) }}</dd>
              <dt>丢失经过</dt><dd>{{ show(claim.description) }}</dd>
              <dt>联系方式</dt><dd>{{ show(claim.contact) }}</dd>
              <dt>提交时间</dt><dd>{{ show(claim.submitted_at) }}</dd>
              <dt>截止时间</dt><dd>{{ show(claim.deadline) }}</dd>
            </dl>
          </div>

          <!-- 主链顺序可视化：提交 → 接单 → 通过 → 核验 → 交接 -->
          <div class="card">
            <h4>主链进度（顺序不可颠倒）</h4>
            <div class="flow">
              <span :class="{ now: claim.status === 'SUBMITTED' }">1 提交</span><i>→</i>
              <span :class="{ now: claim.status === 'UNDER_REVIEW' }">2 接单</span><i>→</i>
              <span :class="{ now: claim.status === 'APPROVED' && !hasVerifyPassed }">3 审核通过</span><i>→</i>
              <span :class="{ now: claim.status === 'APPROVED' && hasVerifyPassed }">4 身份核验</span><i>→</i>
              <span :class="{ now: claim.status === 'COMPLETED' }">5 交接</span>
            </div>
            <div class="notice-box amber" v-if="showVerifyEntry && !hasVerifyPassed">
              <strong>下一步：身份核验（演示步 12）</strong><br>
              VERIFY 是 <span class="mono">APPROVED --VERIFY--> APPROVED</span> 自环，<strong>不改状态</strong>，只写一条 VERIFY 流水；
              它不进迁移表，所以后端 <span class="mono">allowed_events</span> 里没有它，此处仅显示入口。
            </div>
            <div class="notice-box green" v-if="showVerifyEntry && hasVerifyPassed">
              已核验通过（VERIFY 流水已写）。下一步可执行「确认交接」，交接会强制校验不变量 I7。
            </div>
          </div>

          <!-- 审核员操作：按钮来自 allowed_events -->
          <div class="card" v-if="user.role === 'reviewer'">
            <h4>审核操作 · 演示步 9 / 10 / 11</h4>
            <div class="field" style="margin-bottom:14px">
              <label>审核意见 comment（驳回 / 退回补充材料必填，留空时后端返回 40003）</label>
              <input v-model="actionComment" placeholder="如：凭证不足以证明归属，请补充">
            </div>
            <div class="btn-row" style="margin-top:0">
              <button v-for="e in reviewerButtons" :key="e"
                      :class="['btn', (e === 'REJECT' || e === 'REQUEST_INFO' || e === 'HANDOVER') ? 'warn' : '']"
                      @click="doReview(e)">
                {{ e }}（{{ eventText(e) }}）
              </button>
              <button class="btn ghost" v-if="showVerifyEntry" @click="go('verify')">前往身份核验 →</button>
              <span class="muted small" v-if="!reviewerButtons.length && !showVerifyEntry">该状态下无审核员可执行事件（终态或需申请人处理）。</span>
            </div>
            <div class="small muted" style="margin-top:12px">
              提示：未核验直接点 HANDOVER（确认交接）是允许的，按钮不会禁用 —— 后端会返回
              <span class="mono">40003 VALIDATION_ERROR</span> 与「交接前必须先通过身份核验…」，页面会原样红字显示，这是 I7 的现场演示点。
            </div>
          </div>

          <!-- 申请人操作：同样来自 allowed_events -->
          <div class="card" v-if="user.role === 'student'">
            <h4>申请人操作</h4>
            <div class="field" v-if="studentButtons.indexOf('RESUBMIT') >= 0" style="margin-bottom:14px">
              <label class="req">补充材料 proof</label>
              <textarea v-model="supplementProof" placeholder="补交能证明归属的新凭证"></textarea>
            </div>
            <div class="btn-row" style="margin-top:0">
              <button v-if="studentButtons.indexOf('RESUBMIT') >= 0" class="btn" @click="submitSupplement">RESUBMIT（补充材料）</button>
              <button v-if="studentButtons.indexOf('CANCEL') >= 0" class="btn warn" @click="doReview('CANCEL')">CANCEL（撤销申请）</button>
              <span class="muted small" v-if="!studentButtons.length">当前状态无申请人可执行事件。</span>
            </div>
          </div>

          <!-- 流水回放：能看到 APPROVED --VERIFY--> APPROVED 自环 -->
          <div class="card">
            <h4>流转流水（<span class="mono">GET /claims/{id}</span> 的 records）</h4>
            <div class="table-wrap" v-if="claim.records && claim.records.length">
              <table>
                <thead><tr><th>时间</th><th>事件</th><th>状态迁移</th><th>意见 / 说明</th></tr></thead>
                <tbody>
                  <tr v-for="(r, idx) in claim.records" :key="idx">
                    <td class="small">{{ show(r.created_at) }}</td>
                    <td><strong>{{ r.action }}</strong></td>
                    <td class="code">{{ show(r.from_status) }} → {{ show(r.to_status) }}</td>
                    <td>{{ show(r.comment) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="empty" v-else>暂无流水记录。</div>
            <div class="small muted" style="margin-top:10px">
              核验成功后这里会出现一条 <span class="mono">APPROVED → APPROVED</span> 的 VERIFY 自环记录，即「状态不变，已写流水」的证据。
            </div>
          </div>
        </div>
        <div class="empty" v-else>请选择一张认领单：审核员从「审核队列」点「处理」，学生从「我的认领单」点「查看流水」。</div>
      </section>

      <!-- ============ 8. B · 身份核验（演示步 12） ============ -->
      <section v-if="view === 'verify'">
        <h2>身份核验 <span class="code" v-if="claim">#{{ claim.id }}</span></h2>
        <p class="sub">演示步 12 · <span class="mono">POST /review/claims/{id}/verify</span> · 交接前置（不变量 I7）</p>

        <div class="alert alert-info">
          <strong>状态不变，已写 VERIFY 流水。</strong>
          核验是 <span class="mono">APPROVED --VERIFY--> APPROVED</span> 自环：无论核验通过与否，认领单状态都不改变，
          只写一条 VERIFY 流水；只有「核验通过」的流水才能解锁后续交接。
        </div>

        <div class="card" v-if="claim">
          <h4>当前认领单状态</h4>
          <span class="tag" :class="tagClass(claim.status)">{{ claim.status }}（{{ claim.status_text }}）</span>
          <span class="muted small" style="margin-left:12px" v-if="claim.status !== 'APPROVED'">
            注意：后端仅允许 APPROVED 状态核验，当前状态提交会返回 40001。
          </span>
        </div>

        <div class="card">
          <h4>录入到场人信息</h4>
          <div class="grid">
            <div class="field"><label class="req">到场人学号 student_no</label><input v-model="verifyForm.student_no" placeholder="如 stu001"></div>
            <div class="field"><label class="req">到场人姓名 name</label><input v-model="verifyForm.name" placeholder="如 王小明"></div>
          </div>
          <div class="btn-row">
            <button class="btn" @click="submitVerify">提交核验</button>
            <button class="btn gray" @click="fillVerifySeed">填入演示账号（种子数据 stu001 / 王小明）</button>
            <button class="btn ghost" @click="go('handover')">前往交接确认 →</button>
          </div>
          <div class="small muted" style="margin-top:12px">
            故意填错可演示「核验不通过」：同样会写 VERIFY 流水，但不解锁交接，且会给申请人发一条通知。
          </div>
        </div>

        <div class="card" v-if="verifyResult">
          <h4>核验结果</h4>
          <p>
            <span class="tag" :class="verifyResult.verified ? 'tag-green' : 'tag-red'">
              verified = {{ verifyResult.verified }}（{{ verifyResult.verified ? '核验通过' : '核验不通过' }}）
            </span>
          </p>
          <p>{{ verifyResult.comment }}</p>
          <p class="notice-box green">状态不变，已写 VERIFY 流水。返回认领单详情可看到 APPROVED → APPROVED 自环。</p>
          <div class="btn-row">
            <button class="btn ghost" @click="go('claimDetail')">查看流水</button>
            <button class="btn" @click="go('handover')" v-if="verifyResult.verified">前往交接确认 →</button>
          </div>
        </div>
      </section>

      <!-- ============ 9. B · 交接确认（演示步 13） ============ -->
      <section v-if="view === 'handover'">
        <h2>交接确认 <span class="code" v-if="claim">#{{ claim.id }}</span></h2>
        <p class="sub">演示步 13 · <span class="mono">POST /review/claims/{id}/handover</span> · 不变量 I7：交接前必须先核验通过</p>

        <div class="alert alert-amber">
          <strong>现场演示点：按钮不禁用。</strong>
          未核验时直接点「确认交接」，后端返回
          <span class="mono">40003 VALIDATION_ERROR</span> + 「交接前必须先通过身份核验（POST /review/claims/{id}/verify）」，
          页面会原样红字显示，不会静默失败、也不会在前端提前拦掉。
        </div>

        <div class="card" v-if="claim">
          <dl class="kv">
            <dt>认领单状态</dt><dd><span class="tag" :class="tagClass(claim.status)">{{ claim.status }}（{{ claim.status_text }}）</span></dd>
            <dt>核验流水</dt><dd>
              <span class="tag" :class="hasVerifyPassed ? 'tag-green' : 'tag-red'">
                {{ hasVerifyPassed ? '已有「核验通过」VERIFY 流水' : '尚无「核验通过」VERIFY 流水' }}
              </span>
            </dd>
            <dt>可执行事件</dt><dd class="code">{{ claim.allowed_events.join(', ') || '无（终态）' }}</dd>
          </dl>
          <div class="field" style="margin-top:14px"><label>交接备注 comment（选填）</label><input v-model="actionComment" placeholder="如：已核对证件并当面交付"></div>
          <div class="btn-row">
            <button class="btn" @click="doHandover">确认交接（HANDOVER）</button>
            <button class="btn ghost" @click="go('verify')">← 返回身份核验</button>
            <button class="btn gray" @click="go('claimDetail')">查看流水</button>
          </div>
        </div>
        <div class="empty" v-else>请先在「审核队列」或「认领单详情」选择一张认领单。</div>
      </section>

      <!-- ============ 10. B/A · 流水与通知（演示步 15） ============ -->
      <section v-if="view === 'notifications'">
        <h2>流水与通知</h2>
        <p class="sub">演示步 15 · <span class="mono">GET /claims/{id}</span>（records）、<span class="mono">GET /notifications</span></p>
        <div class="card">
          <div class="btn-row" style="margin-top:0">
            <input v-model="openIdInput" placeholder="认领单 ID" style="width:200px;border:1px solid #bcc7d6;border-radius:5px;padding:8px 11px" @keyup.enter="openClaim(Number(openIdInput))">
            <button class="btn ghost" @click="openClaim(Number(openIdInput))" :disabled="!openIdInput">加载该单流水</button>
            <button class="btn gray" @click="loadNotifications">刷新通知</button>
          </div>
        </div>

        <div class="card" v-if="claim && claim.records">
          <h4>认领单 #{{ claim.id }} 流水（{{ claim.status }}（{{ claim.status_text }}））</h4>
          <div class="table-wrap" v-if="claim.records.length">
            <table>
              <thead><tr><th>时间</th><th>事件</th><th>状态迁移</th><th>意见 / 说明</th></tr></thead>
              <tbody>
                <tr v-for="(r, idx) in claim.records" :key="idx">
                  <td class="small">{{ show(r.created_at) }}</td>
                  <td><strong>{{ r.action }}</strong></td>
                  <td class="code">{{ show(r.from_status) }} → {{ show(r.to_status) }}</td>
                  <td>{{ show(r.comment) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="empty" v-else>暂无流水。</div>
          <div class="notice-box" style="margin-bottom:0">
            核验成功后这里出现 <span class="mono">APPROVED --VERIFY--> APPROVED</span> 自环：状态不变，但流水可追溯。
          </div>
        </div>

        <div class="card">
          <h4>我的通知（GET /notifications）</h4>
          <div class="table-wrap" v-if="notifications.length">
            <table>
              <thead><tr><th>ID</th><th>标题</th><th>内容</th><th>已读</th><th>时间</th></tr></thead>
              <tbody>
                <tr v-for="n in notifications" :key="n.id">
                  <td>#{{ n.id }}</td><td>{{ n.title }}</td><td>{{ n.content }}</td>
                  <td>{{ n.is_read ? '是' : '否' }}</td><td class="small">{{ show(n.created_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="empty" v-else>暂无通知（审核通过、核验不通过、交接完成时系统会自动写入）。</div>
        </div>
      </section>

      <!-- ============ 11. C · 数据看板（契约 #29，管理员权限最多） ============ -->
      <section v-if="view === 'adminDashboard'">
        <h2>数据看板</h2>
        <p class="sub">契约 #29 · <span class="mono">GET /admin/stats/overview</span> · 管理员可见全局统计</p>
        <div class="card" v-if="adminStats">
          <h3>用户（共 {{ adminStats.users.total }} 人）</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ adminStats.users.student }}</b><span>学生</span></div>
            <div class="stat"><b>{{ adminStats.users.reviewer }}</b><span>审核员</span></div>
            <div class="stat"><b>{{ adminStats.users.admin }}</b><span>管理员</span></div>
            <div class="stat"><b>{{ adminStats.users.disabled }}</b><span>已停用</span></div>
          </div>
          <h3>物品</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ adminStats.items.found_total }}</b><span>招领登记</span></div>
            <div class="stat"><b>{{ adminStats.items.lost_total }}</b><span>失物登记</span></div>
            <div class="stat"><b>{{ adminStats.items.found_claimed }}</b><span>已认领</span></div>
            <div class="stat"><b>{{ adminStats.items.found_registered }}</b><span>待认领</span></div>
          </div>
          <h3>认领单（共 {{ adminStats.claims.total }} 单）</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ adminStats.claims.completed }}</b><span>已完成</span></div>
            <div class="stat"><b>{{ adminStats.claims.pending }}</b><span>待处理</span></div>
            <div class="stat"><b>{{ adminStats.claims.expired }}</b><span>已超时</span></div>
            <div class="stat"><b>{{ adminStats.audit_total }}</b><span>审计条数</span></div>
          </div>
          <h3>关键指标</h3>
          <div class="stat-grid">
            <div class="stat"><b>{{ adminStats.rates.completion_rate }}%</b><span>完成率</span></div>
            <div class="stat"><b>{{ adminStats.rates.timeout_rate }}%</b><span>超时率</span></div>
            <div class="stat"><b>{{ adminStats.rates.avg_review_minutes }}</b><span>平均审核(分)</span></div>
          </div>
          <div class="notice-box" style="margin-bottom:0">各状态计数：<span class="code">{{ JSON.stringify(adminStats.claims.by_status) }}</span></div>
        </div>
        <div class="empty" v-else>正在加载统计…</div>
      </section>

      <!-- ============ 12. C · 用户管理（契约 #25-26） ============ -->
      <section v-if="view === 'adminUsers'">
        <h2>用户管理</h2>
        <p class="sub">契约 #25-26 · <span class="mono">GET /admin/users</span>、<span class="mono">PUT /admin/users/{id}/status</span> · 启用 / 停用账号</p>
        <div class="card">
          <div class="btn-row" style="margin-top:0">
            <input v-model="userKeyword" placeholder="按学号 / 姓名检索" style="flex:1;min-width:200px;border:1px solid #bcc7d6;border-radius:5px;padding:9px 11px" @keyup.enter="loadAdminUsers">
            <button class="btn" @click="loadAdminUsers">查询</button>
            <button class="btn gray" @click="userKeyword='';loadAdminUsers()">清空</button>
          </div>
        </div>
        <div class="table-wrap" v-if="adminUsers.length">
          <table>
            <thead><tr><th>ID</th><th>学号</th><th>姓名</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="u in adminUsers" :key="u.id">
                <td>#{{ u.id }}</td><td>{{ u.student_no }}</td><td>{{ u.name }}</td>
                <td><span class="tag" :class="u.role === 'super_admin' ? 'tag-purple' : (u.role === 'reviewer' ? 'tag-blue' : 'tag-gray')">{{ u.role }}</span></td>
                <td><span class="tag" :class="u.status === 'ACTIVE' ? 'tag-green' : 'tag-red'">{{ u.status }}</span></td>
                <td class="nowrap">
                  <button class="btn ghost" style="padding:5px 10px" v-if="u.status === 'ACTIVE'" @click="setUserStatus(u,'DISABLED')">停用</button>
                  <button class="btn" style="padding:5px 10px" v-else @click="setUserStatus(u,'ACTIVE')">启用</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>无匹配用户。</div>
      </section>

      <!-- ============ 13. C · 分类字典维护（契约 #27） ============ -->
      <section v-if="view === 'adminCategories'">
        <h2>分类字典维护</h2>
        <p class="sub">契约 #27 · <span class="mono">GET / POST /admin/dict/categories</span></p>
        <div class="card">
          <div class="grid">
            <div class="field"><label class="req">分类名称</label><input v-model="catForm.name" placeholder="如：雨具"></div>
            <div class="field"><label>排序</label><input v-model.number="catForm.sort_order" type="number"></div>
          </div>
          <div class="btn-row"><button class="btn" @click="addCategory">新增分类</button></div>
        </div>
        <div class="table-wrap" v-if="adminCategories.length">
          <table>
            <thead><tr><th>ID</th><th>名称</th><th>排序</th></tr></thead>
            <tbody>
              <tr v-for="c in adminCategories" :key="c.id"><td>#{{ c.id }}</td><td>{{ c.name }}</td><td>{{ c.sort_order }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>暂无分类。</div>
      </section>

      <!-- ============ 14. C · 地点字典维护（契约 #28） ============ -->
      <section v-if="view === 'adminLocations'">
        <h2>地点字典维护</h2>
        <p class="sub">契约 #28 · <span class="mono">GET / POST /admin/dict/locations</span></p>
        <div class="card">
          <div class="grid">
            <div class="field"><label class="req">地点名称</label><input v-model="locForm.name" placeholder="如：实验楼"></div>
            <div class="field"><label>排序</label><input v-model.number="locForm.sort_order" type="number"></div>
          </div>
          <div class="btn-row"><button class="btn" @click="addLocation">新增地点</button></div>
        </div>
        <div class="table-wrap" v-if="adminLocations.length">
          <table>
            <thead><tr><th>ID</th><th>名称</th><th>排序</th></tr></thead>
            <tbody>
              <tr v-for="l in adminLocations" :key="l.id"><td>#{{ l.id }}</td><td>{{ l.name }}</td><td>{{ l.sort_order }}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>暂无地点。</div>
      </section>

      <!-- ============ 15. C · 操作日志（契约 #30） ============ -->
      <section v-if="view === 'adminLogs'">
        <h2>操作日志</h2>
        <p class="sub">契约 #30 · <span class="mono">GET /admin/audit-logs</span>、<span class="mono">GET /admin/export/claims.csv</span></p>
        <div class="card">
          <div class="btn-row" style="margin-top:0">
            <input v-model="logEntity" placeholder="按 entity 过滤（user / claim / category …）" style="flex:1;min-width:200px;border:1px solid #bcc7d6;border-radius:5px;padding:9px 11px" @keyup.enter="loadAdminLogs">
            <button class="btn" @click="loadAdminLogs">刷新</button>
            <button class="btn gray" @click="logEntity='';loadAdminLogs()">清空过滤</button>
            <button class="btn ghost" @click="exportClaims">导出认领单 CSV</button>
          </div>
        </div>
        <div class="table-wrap" v-if="adminLogs.length">
          <table>
            <thead><tr><th>ID</th><th>操作者</th><th>对象</th><th>动作</th><th>说明</th><th>时间</th></tr></thead>
            <tbody>
              <tr v-for="a in adminLogs" :key="a.id">
                <td>#{{ a.id }}</td><td>#{{ a.actor_id }}</td>
                <td>{{ a.entity }} / {{ a.entity_id }}</td>
                <td><span class="tag tag-purple">{{ a.action }}</span></td>
                <td>{{ show(a.detail) }}</td>
                <td class="small">{{ show(a.created_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="empty" v-else>暂无日志（管理员的操作会实时写入）。</div>
      </section>

    </div>
  </div>
</div>
`
  }).mount('#app');
})();
