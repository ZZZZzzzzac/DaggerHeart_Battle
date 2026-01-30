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
    
    // 覆盖导出文件名 (TXT)
    exportData() {
        const content = this.filteredEnemies.map(e => this.formatItemText(e)).join('\n');
        this.downloadTxtContent(content, "environment_library_export.txt");
    }

    // 格式化文本 (环境)
    formatItemText(item) {
        const name = item['名称']||'未命名';
        const eng = item['原文']||'';
        const tier = item['位阶']||'-';
        const type = item['种类']||'-';
        const intro = item['简介']||'';
        const tend = item['趋向']||'无';
        const dc = item['难度']||'无';
        const enemy = item['潜在敌人']||'无';

        let traitsStr = '';
        if (item['特性'] && Array.isArray(item['特性']) && item['特性'].length > 0) {
            const traitList = item['特性'].map(t => {
                const tName = t['名称'] || '未命名';
                const tType = t['类型'] || '-';
                const tDesc = t['特性描述'] || '';
                const tQuest = t['特性问题']||'';
                return `${tName} ${tType}： ${tDesc}\n${tQuest}`;
            }).join('\n\n');
            traitsStr = `${traitList}\n`;
        }

        return `
${name} ${eng}
位阶${tier} ${type}
${intro}
趋向：${tend}
难度：${dc}
潜在敌人：${enemy}

特性
${traitsStr}
`;
    }

    // 覆盖导出文件名
    exportFilteredData() {
        this.downloadJson(this.filteredEnemies, "environment_library_filtered.json");
    }
}
