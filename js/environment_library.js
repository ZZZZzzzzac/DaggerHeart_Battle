/**
 * 环境库模块
 * 继承自 EnemyLibrary，管理环境数据
 */

class EnvironmentLibrary extends EnemyLibrary {
    constructor(containerId, options = {}) {
        // 强制设置环境库特有的配置
        const envOptions = Object.assign({}, options, {
            idPrefix: 'env-lib',
            storageKey: 'trpg_environment_library',
            supportedType: '环境',
            defaultSources: ['核心书']
        });
        
        super(containerId, envOptions);
    }

    loadData() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.enemies = JSON.parse(stored);
                // 兼容性与数据清洗
                this.enemies.forEach(e => {
                    if (!e['来源']) e['来源'] = '自定义';
                    if (e.source) delete e.source;
                    if (!e.id) e.id = this.generateUUID();
                    if (!e['类型']) e['类型'] = '环境'; // 确保类型标识
                });
            } catch (e) {
                console.error('Failed to parse environment library data', e);
                this.enemies = [];
            }
        }
        // 如果本地没有数据，加载默认数据
        if (this.enemies.length === 0) {
            let defaults = [];
            if (typeof ENVIRONMENT_CRB !== 'undefined') defaults = defaults.concat(ENVIRONMENT_CRB);
            if (typeof ENVIRONMENT_VOID !== 'undefined') defaults = defaults.concat(ENVIRONMENT_VOID);
            
            if (defaults.length > 0) {
                this.enemies = defaults;
                // 确保有 ID 和类型
                this.enemies.forEach(e => {
                    if (!e.id) e.id = this.generateUUID();
                    if (!e['类型']) e['类型'] = '环境';
                    // 核心书数据的来源通常已经是'核心书'，但如果是自定义数据可能需要处理
                    // 这里我们保留原来源，如果为空则设为'自定义'
                    if (!e['来源']) e['来源'] = '自定义';
                });
                this.saveData();
            }
        }
    }
    
    // 覆盖导出文件名
    exportData() {
        this.downloadJson(this.enemies, "environment_library_all.json");
    }

    // 覆盖导出文件名
    exportFilteredData() {
        this.downloadJson(this.filteredEnemies, "environment_library_filtered.json");
    }
}
