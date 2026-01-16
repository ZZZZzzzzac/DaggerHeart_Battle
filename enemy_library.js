/**
 * 敌人库模块
 * 管理敌人数据的存储、展示、筛选、导入导出
 */

class EnemyLibrary {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Library container #${containerId} not found.`);
            return;
        }
        
        this.storageKey = 'trpg_enemy_library';
        this.enemies = [];
        this.filteredEnemies = [];
        
        // 回调函数
        this.onSelect = options.onSelect || null; // (enemyData) => {}
        this.onRequestNew = options.onRequestNew || null; // () => {}
        this.onRequestEdit = options.onRequestEdit || null; // (enemyData, index) => {}

        this.filters = {
            search: '',
            tier: '',
            category: '',
            source: ''
        };
        
        this.sort = {
            field: '位阶',
            order: 'asc'
        };

        this.init();
    }

    init() {
        this.loadData();
        this.renderUI();
        this.updateSourceFilterOptions();
        this.applyFilters();
    }

    loadData() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.enemies = JSON.parse(stored);
                // 兼容性修复：为已存在的默认数据添加“来源”字段
                this.enemies.forEach(e => {
                    if (e.source === 'default' && !e['来源']) {
                        e['来源'] = '核心书';
                    }
                });
            } catch (e) {
                console.error('Failed to parse enemy library data', e);
                this.enemies = [];
            }
        } 
        
        // 如果本地没有数据，且存在默认数据 ADVERSARY，则加载默认数据
        if (this.enemies.length === 0 && typeof ADVERSARY !== 'undefined') {
            this.enemies = ADVERSARY.map(e => ({
                ...e, 
                source: 'default',
                '来源': '核心书'
            }));
            this.saveData();
        }
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.enemies));
    }

    // 添加或更新敌人
    saveEnemy(enemyData, index = -1) {
        // 标记为自定义来源 (内部标记，用于颜色区分等，如果还需要的话)
        // 但现在主要依靠近 '来源' 字段
        enemyData.source = enemyData.source || 'custom';
        
        if (index >= 0) {
            this.enemies[index] = enemyData;
        } else {
            this.enemies.push(enemyData);
        }
        this.saveData();
        this.updateSourceFilterOptions();
        this.applyFilters(); // 重新渲染
    }

    deleteEnemy(index) {
        if (confirm('确定要删除这个敌人吗？')) {
            this.enemies.splice(index, 1);
            this.saveData();
            this.updateSourceFilterOptions();
            this.applyFilters();
        }
    }

    // 导出数据
    exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.enemies, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "enemy_library_export.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    // 导入数据
    importData(file) {
        const defaultSource = file.name.replace(/\.json$/i, ''); // 获取文件名作为默认来源

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    let addedCount = 0;
                    let skippedCount = 0;

                    importedData.forEach(importedEnemy => {
                        // 如果没有来源，使用文件名作为来源
                        if (!importedEnemy['来源']) {
                            importedEnemy['来源'] = defaultSource;
                        }

                        // 检查同名
                        const exists = this.enemies.some(existing => existing['名称'] === importedEnemy['名称']);
                        if (!exists) {
                            importedEnemy.source = 'custom';
                            this.enemies.push(importedEnemy);
                            addedCount++;
                        } else {
                            skippedCount++;
                        }
                    });

                    this.saveData();
                    this.updateSourceFilterOptions();
                    this.applyFilters();
                    alert(`导入完成：成功 ${addedCount} 个，跳过同名 ${skippedCount} 个`);
                } else {
                    alert('导入文件格式错误：必须是数组');
                }
            } catch (e) {
                alert('导入失败：JSON 解析错误');
            }
        };
        reader.readAsText(file);
    }

    renderUI() {
        this.container.classList.add('library-container');
        this.container.innerHTML = `
            <div class="library-header">
                <div class="library-title">
                    <span>敌人库</span>
                    <span style="font-size:0.8em;color:#666;" id="lib-count">0</span>
                </div>
                <div class="library-actions">
                    <button class="lib-btn primary" id="lib-btn-new">新建</button>
                    <button class="lib-btn" id="lib-btn-export">导出</button>
                    <label class="lib-btn" style="text-align:center; margin:0;">
                        导入 <input type="file" id="lib-file-import" style="display:none;" accept=".json">
                    </label>
                </div>
                <div class="filter-section">
                    <input type="text" class="search-input" id="lib-search" placeholder="搜索名称...">
                    <div class="filter-row">
                        <select class="filter-select" id="lib-filter-source">
                            <option value="">所有来源</option>
                            <!-- 动态填充 -->
                        </select>
                        <select class="filter-select" id="lib-filter-tier">
                            <option value="">所有位阶</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                        </select>
                        <select class="filter-select" id="lib-filter-category">
                            <option value="">所有种类</option>
                            <option value="标准">标准</option>
                            <option value="杂兵">杂兵</option>
                            <option value="头目">头目</option>
                            <option value="独狼">独狼</option>
                            <option value="斗士">斗士</option>
                            <option value="远程">远程</option>
                            <option value="潜伏">潜伏</option>
                            <option value="社交">社交</option>
                            <option value="辅助">辅助</option>
                            <option value="集群">集群</option>
                        </select>
                    </div>
                </div>
                <div class="sort-controls">
                    排序: 
                    <button class="sort-btn" data-sort="位阶">位阶</button> |
                    <button class="sort-btn" data-sort="种类">种类</button> |
                    <button class="sort-btn" data-sort="来源">来源</button>
                </div>
            </div>
            <div class="enemy-list" id="lib-list">
                <!-- 列表内容 -->
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        // 筛选事件
        const searchInput = this.container.querySelector('#lib-search');
        const sourceSelect = this.container.querySelector('#lib-filter-source');
        const tierSelect = this.container.querySelector('#lib-filter-tier');
        const catSelect = this.container.querySelector('#lib-filter-category');

        const handleFilter = () => {
            this.filters.search = searchInput.value.toLowerCase();
            this.filters.source = sourceSelect.value;
            this.filters.tier = tierSelect.value;
            this.filters.category = catSelect.value;
            this.applyFilters();
        };

        searchInput.addEventListener('input', handleFilter);
        sourceSelect.addEventListener('change', handleFilter);
        tierSelect.addEventListener('change', handleFilter);
        catSelect.addEventListener('change', handleFilter);

        // 排序事件
        this.container.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const field = btn.dataset.sort;
                if (this.sort.field === field) {
                    this.sort.order = this.sort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sort.field = field;
                    this.sort.order = 'asc';
                }
                this.applyFilters();
            });
        });

        // 按钮事件
        this.container.querySelector('#lib-btn-new').addEventListener('click', () => {
            if (this.onRequestNew) this.onRequestNew();
        });

        this.container.querySelector('#lib-btn-export').addEventListener('click', () => {
            this.exportData();
        });

        this.container.querySelector('#lib-file-import').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = ''; // 重置以便再次选择
            }
        });
    }

    // 更新来源筛选下拉框
    updateSourceFilterOptions() {
        const sourceSelect = this.container.querySelector('#lib-filter-source');
        if (!sourceSelect) return;

        const currentVal = sourceSelect.value;
        const sources = new Set();
        
        this.enemies.forEach(e => {
            if (e['来源']) sources.add(e['来源']);
        });
        
        // 保留 "所有来源" 选项
        sourceSelect.innerHTML = '<option value="">所有来源</option>';
        
        Array.from(sources).sort().forEach(src => {
            const option = document.createElement('option');
            option.value = src;
            option.textContent = src;
            sourceSelect.appendChild(option);
        });
        
        // 尝试恢复之前的选择，如果该选项已不存在（比如删除了唯一的该来源敌人），则 value 为空，变为“所有来源”
        sourceSelect.value = currentVal;
        // 如果恢复失败（currentVal 不再有效），则 filters 也应该重置吗？
        // 如果 currentVal 不为空但下拉框里没有了，sourceSelect.value 会变成 ""。
        // 这时应该更新 filters。
        if (sourceSelect.value !== currentVal) {
            this.filters.source = "";
        }
    }

    applyFilters() {
        let result = this.enemies.filter(enemy => {
            // 搜索
            if (this.filters.search && !enemy['名称'].toLowerCase().includes(this.filters.search)) return false;
            // 来源
            if (this.filters.source && enemy['来源'] !== this.filters.source) return false;
            // 位阶
            if (this.filters.tier && String(enemy['位阶']) !== this.filters.tier) return false;
            // 种类
            if (this.filters.category) {
                if (this.filters.category === '集群') {
                    if (!enemy['种类'] || !enemy['种类'].startsWith('集群')) return false;
                } else {
                    if (enemy['种类'] !== this.filters.category) return false;
                }
            }
            return true;
        });

        // 排序
        result.sort((a, b) => {
            let valA = a[this.sort.field] || '';
            let valB = b[this.sort.field] || '';
            
            // 特殊处理
            if (this.sort.field === '位阶') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            }

            if (valA < valB) return this.sort.order === 'asc' ? -1 : 1;
            if (valA > valB) return this.sort.order === 'asc' ? 1 : -1;
            return 0;
        });

        this.filteredEnemies = result;
        this.renderList();
    }

    renderList() {
        const listContainer = this.container.querySelector('#lib-list');
        const countLabel = this.container.querySelector('#lib-count');
        
        listContainer.innerHTML = '';
        countLabel.textContent = `(${this.filteredEnemies.length})`;

        this.filteredEnemies.forEach(enemy => {
            // 找到原始索引用于更新/删除
            const originalIndex = this.enemies.indexOf(enemy);
            
            const item = document.createElement('div');
            item.className = 'enemy-list-item';
            
            // 来源标记颜色 (可选保留)
            const sourceClass = enemy.source === 'default' ? 'source-default' : 'source-custom';
            // 显示来源名称作为 title
            const sourceTitle = enemy['来源'] || (enemy.source === 'default' ? '核心书' : '自定义');

            item.innerHTML = `
                <div class="item-header">
                    <span class="item-name">${enemy['名称']}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <div class="source-tag ${sourceClass}" title="${sourceTitle}" style="position:static; margin:0;"></div>
                        <span class="item-tier">位阶 ${enemy['位阶']}</span>
                        <button class="lib-item-delete" title="删除">×</button>
                    </div>
                </div>
                <div class="item-details">
                    <span class="item-tag">${enemy['种类']}</span>
                    <span class="item-tag">难度 ${enemy['难度']}</span>
                </div>
            `;

            // 点击选择
            item.addEventListener('click', (e) => {
                // 如果点击的是操作按钮，不触发选择
                if (e.target.tagName === 'BUTTON' || e.target.classList.contains('lib-item-delete')) return;
                
                if (this.onSelect) this.onSelect(enemy);
            });

            // 删除按钮事件
            item.querySelector('.lib-item-delete').addEventListener('click', (e) => {
                e.stopPropagation(); 
                this.deleteEnemy(originalIndex);
            });

            // 右键编辑
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (this.onRequestEdit) this.onRequestEdit(enemy, originalIndex);
            });

            listContainer.appendChild(item);
        });
    }
}
