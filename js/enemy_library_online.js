/**
 * 线上敌人库模块
 * 负责与 Supabase 云端数据库进行交互
 * 依赖: @supabase/supabase-js, js/enemy_library.js
 */

// ==========================================
// 🔴 配置区域 (请填写你的 Supabase 信息)
// ==========================================
const SUPABASE_URL = 'https://isqlpggxezvdcoupgjpy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_smqqs8pIJiCrEJErff4maQ_Nvt9g0YL';
// ==========================================

class OnlineEnemyLibrary {
    constructor(libraryInstance, envLibraryInstance) {
        this.library = libraryInstance;
        this.envLibrary = envLibraryInstance;
        this.client = null;
        this.user = null;
        this.currentUserId = undefined;
        
        this.init();
    }

    async init() {
        if (!window.supabase) {
            console.error('Supabase SDK not loaded.');
            return;
        }

        // 初始化 Supabase 客户端
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // 绑定 UI 元素
        this.bindUI();

        // 检查登录状态
        const { data: { session } } = await this.client.auth.getSession();
        this.handleSession(session);

        // 监听登录状态变化
        this.client.auth.onAuthStateChange((_event, session) => {
            this.handleSession(session);
        });
    }

    handleSession(session) {
        const newUserId = session?.user?.id || null;
        
        // 如果用户状态没有变化，则跳过
        if (newUserId === this.currentUserId) {
            return;
        }
        
        this.currentUserId = newUserId;
        this.user = session ? session.user : null;
        this.updateUIState();
        
        if (this.user) {
            console.log('Logged in as:', this.user.email);
        } else {
            console.log('Guest Mode (Public Read)');
        }
        // 无论是否登录，都尝试拉取数据 (RLS 策略应设置为允许 public select)
        this.fetchFromCloud(true); // 自动拉取静默执行
    }

    bindUI() {
        this.controlsEl = document.getElementById('online-controls');
        this.modalEl = document.getElementById('online-login-modal');
        
        if (!this.controlsEl || !this.modalEl) {
             console.error('Online UI elements not found in index.html');
             return;
        }

        // 模态框事件
        const closeBtn = document.getElementById('btn-close-online-modal');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.modalEl.classList.remove('active');
            });
        }

        const loginBtn = document.getElementById('btn-do-login');
        if(loginBtn) {
            loginBtn.addEventListener('click', () => this.doLogin());
        }

        const signupBtn = document.getElementById('btn-do-signup');
        if(signupBtn) {
            signupBtn.addEventListener('click', () => this.doSignup());
        }

        // 控制栏按钮事件
        const authBtn = document.getElementById('btn-online-auth');
        if(authBtn) {
            authBtn.addEventListener('click', () => this.toggleAuth());
        }

        const downloadBtn = document.getElementById('btn-online-download');
        if(downloadBtn) {
            downloadBtn.addEventListener('click', () => this.fetchFromCloud(false));
        }

        const uploadBtn = document.getElementById('btn-online-upload');
        if(uploadBtn) {
            uploadBtn.addEventListener('click', () => this.syncData());
        }
    }

    toggleAuth() {
        if (this.user) {
             this.client.auth.signOut();
        } else {
             this.modalEl.classList.add('active');
        }
    }

    async doLogin() {
        const email = document.getElementById('online-email').value;
        const password = document.getElementById('online-password').value;
        const { error } = await this.client.auth.signInWithPassword({ email, password });
        if (error) alert('登录失败: ' + error.message);
        else this.modalEl.classList.remove('active');
    }

    async doSignup() {
        const email = document.getElementById('online-email').value;
        const password = document.getElementById('online-password').value;
        const { error } = await this.client.auth.signUp({ email, password });
        if (error) alert('注册请求已发送，请检查邮箱验证或直接登录（视项目配置而定）: ' + error.message);
        else alert('注册成功，请登录');
    }

    updateUIState() {
        if (!this.controlsEl) return;
        
        const usernameEl = document.getElementById('online-username');
        const dotEl = document.getElementById('online-status-dot');
        const uploadBtn = document.getElementById('btn-online-upload');
        const authBtn = document.getElementById('btn-online-auth');

        if (this.user) {
            // Logged In
            if(usernameEl) usernameEl.textContent = this.user.email.split('@')[0];
            if(dotEl) dotEl.className = 'status-dot online';
            
            // Show Upload
            if(uploadBtn) uploadBtn.classList.remove('hidden');
            
            // Update Auth Button
            if(authBtn) {
                authBtn.textContent = '退出';
                authBtn.classList.remove('primary');
                authBtn.classList.add('secondary');
            }
        } else {
            // Logged Out
            if(usernameEl) usernameEl.textContent = '离线';
            if(dotEl) dotEl.className = 'status-dot offline';
            
            // Hide Upload
            if(uploadBtn) uploadBtn.classList.add('hidden');
            
            // Update Auth Button
            if(authBtn) {
                authBtn.textContent = '登录';
                authBtn.classList.remove('secondary');
                authBtn.classList.add('primary');
            }
        }
    }

    // 拉取云端数据
    async fetchFromCloud(silent = false) {
        console.log('Fetching cloud data...');
        
        const { data: cloudItems, error } = await this.client
            .from('shared_enemies') // 统一从 shared_enemies 表拉取
            .select('*');

        if (error) {
            console.error('Error fetching cloud data:', error);
            if (!silent) alert('同步失败: ' + error.message);
            return;
        }

        if (cloudItems && cloudItems.length > 0) {
            const enemies = [];
            const environments = [];

            cloudItems.forEach(row => {
                const item = row.data;
                item.db_id = row.id;
                item.user_id = row.author_id;

                if (item['类型'] === '环境') {
                    environments.push(item);
                } else {
                    enemies.push(item);
                }
            });

            // 1. Merge Enemies
            const resultEnemies = this.library.mergeData(enemies, '云端');
            
            // 2. Merge Environments
            let resultEnv = { added: 0, updated: 0 };
            if (this.envLibrary && environments.length > 0) {
                resultEnv = this.envLibrary.mergeData(environments, '云端');
            }

            const msg = `云端同步完成：敌人 (+${resultEnemies.added}/^${resultEnemies.updated})，环境 (+${resultEnv.added}/^${resultEnv.updated})`;
            console.log(msg);
            if (!silent) alert(msg);
        } else {
            if (!silent) alert('云端暂无数据');
        }
    }

    // 删除云端数据
    async deleteFromCloud(id) {
        if (!this.user) return false;
        
        const { error } = await this.client
            .from('shared_enemies')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Delete failed:', error);
            return false;
        }
        return true;
    }

    // 上传/同步逻辑
    async syncData() {
        if (!this.user) return;

        if (!confirm('确定要将当前的本地自定义数据同步到云端吗？\n这将覆盖云端已有的同名数据。')) return;

        // 1. Gather all uploadable items
        const enemiesToUpload = this.getUploadableItems(this.library);
        let environmentsToUpload = [];
        if (this.envLibrary) {
            environmentsToUpload = this.getUploadableItems(this.envLibrary);
        }

        const allItems = [...enemiesToUpload, ...environmentsToUpload];

        if (allItems.length === 0) {
            alert('没有可上传的自定义数据 (别人的数据或官方数据不会被上传)');
            return;
        }

        // 2. Prepare Payload
        const payload = allItems.map(e => {
            let targetId = e.db_id || e.id;
            
            if (!targetId) {
                // 如果没有 ID，生成一个。注意：这会修改本地对象
                targetId = this.library.generateUUID ? this.library.generateUUID() : crypto.randomUUID();
                e.id = targetId;
            }

            return {
                id: targetId,
                name: e['名称'],
                data: e,
                author_id: this.user.id
            };
        });

        // 3. Upsert to single table
        const { data, error } = await this.client
            .from('shared_enemies')
            .upsert(payload, { onConflict: 'id' })
            .select();

        if (error) {
            console.error('Upload failed:', error);
            alert('上传失败: ' + error.message);
        } else {
            alert(`成功上传 ${data.length} 条数据！`);
            // 重新拉取以更新本地的 db_id
            this.fetchFromCloud(true);
        }
    }

    getUploadableItems(libInstance) {
        // EnvironmentLibrary 继承自 EnemyLibrary，也有 getUploadableEnemies 方法
        const candidates = libInstance.getUploadableEnemies();
        return candidates.filter(e => {
            // 如果有 user_id (说明来自云端) 且不是当前用户，则不上传
            if (e.user_id && e.user_id !== this.user.id) {
                return false;
            }
            return true;
        });
    }
}

// 自动初始化
window.addEventListener('load', () => { // 使用 load 确保所有脚本执行完毕
    const checkApp = setInterval(() => {
        // 检查两个库是否都已就绪
        if (window.battleApp && window.battleApp.library) {
            clearInterval(checkApp);
            console.log('Found BattleApp Libraries, initializing Online Mode...');
            window.onlineLibrary = new OnlineEnemyLibrary(
                window.battleApp.library, 
                window.battleApp.envLibrary // 传入环境库实例 (可能为 undefined 如果 battleApp 初始化方式不同，但 BattlePanel 构造函数里初始化了)
            );
        }
    }, 100);
    
    // 超时停止
    setTimeout(() => clearInterval(checkApp), 5000);
});
