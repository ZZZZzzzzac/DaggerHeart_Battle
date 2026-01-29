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
        
        this.idPrefix = options.idPrefix || 'lib'; // ID 前缀，默认为 'lib'
        this.storageKey = options.storageKey || 'trpg_enemy_library'; // 存储键名
        this.supportedType = options.supportedType || '敌人'; // 支持的数据类型

        this.enemies = []; // 数据列表 (在子类中可能存放环境数据)
        this.filteredEnemies = [];
        
        // 回调函数
        this.onSelect = options.onSelect || null; // (data) => {}
        this.onRequestNew = options.onRequestNew || null; // () => {}
        this.onRequestEdit = options.onRequestEdit || null; // (data, index) => {}
        this.onSyncRequest = options.onSyncRequest || null; // () => {} (请求同步/上传)

        this.filters = {
            search: '',
            tier: [],
            category: [],
            source: options.defaultSources || ['核心书'] // 默认显示来源
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
        this.applyFilters();
    }

    loadData() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                this.enemies = JSON.parse(stored);
                // 兼容性修复：确保所有数据都有“来源”和“id”
                this.enemies.forEach(e => {
                    if (!e['来源']) {
                        e['来源'] = '自定义';
                    }
                    // 清理旧的 source 字段
                    if (e.source) delete e.source;
                    // 确保有 ID
                    if (!e.id) e.id = this.generateUUID();
                });
            } catch (e) {
                console.error('Failed to parse enemy library data', e);
                this.enemies = [];
            }
        }
        
        // 如果本地没有数据，加载默认数据
        if (this.enemies.length === 0) {
            let defaults = [];
            if (typeof ADVERSARY_CRB !== 'undefined') defaults = defaults.concat(ADVERSARY_CRB);
            if (typeof ADVERSARY_VOID !== 'undefined') defaults = defaults.concat(ADVERSARY_VOID);
            
            if (defaults.length > 0) {
                this.enemies = defaults;
                this.saveData();
            }
        }
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.enemies));
    }

    // 生成 UUID
    generateUUID() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // 添加或更新敌人
    saveEnemy(enemyData, index = -1) {
        // 类型检查与修正
        if (enemyData['类型'] && enemyData['类型'] !== this.supportedType) {
            console.warn(`Type mismatch: expected ${this.supportedType}, got ${enemyData['类型']}`);
            // 可以在这里拒绝，或者强制修改类型，或者忽略
            // 根据用户要求，应该检查。为了防止混淆，如果不匹配则不保存或提示。
            // 但考虑到新建时可能没有类型，我们这里强制设为支持的类型
            enemyData['类型'] = this.supportedType;
        } else if (!enemyData['类型']) {
            enemyData['类型'] = this.supportedType;
        }

        // 确保数据有 ID
        if (!enemyData.id) {
            enemyData.id = this.generateUUID();
        }

        if (index >= 0) {
            this.enemies[index] = enemyData;
        } else {
            this.enemies.push(enemyData);
        }
        this.saveData();
        this.applyFilters(); // 重新渲染
    }

    async deleteEnemy(index) {
        const enemy = this.enemies[index];
        if (!confirm('确定要删除这个敌人吗？')) return;

        // 检查云端关联：如果是当前登录用户发布的，询问是否删除云端
        const onlineLib = window.onlineLibrary;
        if (onlineLib && onlineLib.user && enemy.user_id === onlineLib.user.id) {
            if (confirm('检测到该项目是您发布的，是否将云端对应数据也删除？')) {
                const idToDelete = enemy.db_id || enemy.id;
                const success = await onlineLib.deleteFromCloud(idToDelete);
                if (success) {
                    alert('云端数据已删除');
                } else {
                    alert('云端删除失败，继续删除本地副本');
                }
            }
        }

        this.enemies.splice(index, 1);
        this.saveData();
        this.applyFilters();
    }

    // 导出数据 (全部)
    exportData() {
        this.downloadJson(this.enemies, "enemy_library_all.json");
    }

    // 导出数据 (当前筛选)
    exportFilteredData() {
        this.downloadJson(this.filteredEnemies, "enemy_library_filtered.json");
    }

    // 辅助下载
    downloadJson(data, filename) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
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
                    this.mergeData(importedData, defaultSource);
                    alert(`导入完成`);
                } else {
                    alert('导入文件格式错误：必须是数组');
                }
            } catch (e) {
                alert('导入失败：JSON 解析错误');
            }
        };
        reader.readAsText(file);
    }

    // 通用数据合并逻辑 (用于文件导入和云端同步)
    mergeData(newData, defaultSource = '自定义') {
        let addedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        newData.forEach(newItem => {
            // 类型检查
            // 如果数据没有类型，默认为 '敌人' (兼容旧数据)
            const itemType = newItem['类型'] || '敌人';
            if (itemType !== this.supportedType) {
                skippedCount++;
                return; // 跳过不匹配的类型
            }
            // 确保类型字段存在
            newItem['类型'] = this.supportedType;

            // 如果没有来源
            if (!newItem['来源']) {
                newItem['来源'] = defaultSource;
            }
            if (newItem.source) delete newItem.source;
            
            // 确保 newItem 有 ID
            if (!newItem.id) newItem.id = this.generateUUID();

            // 检查 ID (仅使用 ID 匹配)
            const index = this.enemies.findIndex(existing => existing.id === newItem.id);

            if (index === -1) {
                // 新增
                this.enemies.push(newItem);
                addedCount++;
            } else {
                // 更新 (覆盖本地)
                this.enemies[index] = newItem;
                updatedCount++;
            }
        });

        this.saveData(); // 保存到 localStorage
        this.applyFilters();
        
        console.log(`Merge complete: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped.`);
        if (skippedCount > 0) {
            alert(`已导入 ${addedCount + updatedCount} 条数据，跳过 ${skippedCount} 条类型不匹配的数据。`);
        }
        return { added: addedCount, updated: updatedCount, skipped: skippedCount };
    }

    // 获取可上传的数据 (排除只读源)
    getUploadableEnemies() {
        return this.enemies.filter(e => {
            return e['来源'] !== '核心书' && e['来源'] !== 'VOID';
        });
    }

    setupMultiSelects() {
        this.createMultiSelect(`${this.idPrefix}-filter-source`, 'source', '来源');
        this.createMultiSelect(`${this.idPrefix}-filter-tier`, 'tier', '位阶');
        this.createMultiSelect(`${this.idPrefix}-filter-category`, 'category', '种类');
    }

    createMultiSelect(selectId, filterKey, labelText) {
        const select = this.container.querySelector('#' + selectId);
        if (!select) return;
        
        // Check if already created
        if (select.nextSibling && select.nextSibling.classList && select.nextSibling.classList.contains('multi-select-container')) {
            return;
        }

        select.style.display = 'none'; // Hide original
        
        const container = document.createElement('div');
        container.className = 'multi-select-container';
        container.dataset.targetId = selectId;
        
        const btn = document.createElement('div');
        btn.className = 'multi-select-btn';
        btn.textContent = labelText;
        
        const dropdown = document.createElement('div');
        dropdown.className = 'multi-select-dropdown';

        btn.onclick = (e) => {
            // Close others
            this.container.querySelectorAll('.multi-select-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
            e.stopPropagation();
        };
        
        container.appendChild(btn);
        container.appendChild(dropdown);
        
        select.parentNode.insertBefore(container, select.nextSibling); // Insert after select
        
        // Initial population
        this.refreshMultiSelectUI(selectId, filterKey, labelText);
    }

    refreshMultiSelectUI(selectId, filterKey, labelText) {
        const select = this.container.querySelector('#' + selectId);
        const container = this.container.querySelector(`.multi-select-container[data-target-id="${selectId}"]`);
        if (!select || !container) return;
        
        const dropdown = container.querySelector('.multi-select-dropdown');
        const btn = container.querySelector('.multi-select-btn');
        
        dropdown.innerHTML = '';
        
        // Get options from original select
        Array.from(select.options).forEach(opt => {
            if (opt.value === "") return; // Skip "All" placeholder
            
            const optionDiv = document.createElement('label');
            optionDiv.className = 'multi-select-option';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = opt.value;
            // Check if currently selected in filters
            if (this.filters[filterKey].includes(opt.value)) {
                checkbox.checked = true;
            }
            
            checkbox.addEventListener('change', () => {
                const val = checkbox.value;
                if (checkbox.checked) {
                    if (!this.filters[filterKey].includes(val)) {
                        this.filters[filterKey].push(val);
                    }
                } else {
                    this.filters[filterKey] = this.filters[filterKey].filter(v => v !== val);
                }
                this.updateMultiSelectBtnText(btn, this.filters[filterKey], labelText);
                this.applyFilters();
            });
            
            optionDiv.appendChild(checkbox);
            optionDiv.appendChild(document.createTextNode(opt.text));
            dropdown.appendChild(optionDiv);
        });
        
        // Update button text
        this.updateMultiSelectBtnText(btn, this.filters[filterKey], labelText);
    }
    
    updateMultiSelectBtnText(btn, selectedValues, labelText) {
        if (selectedValues.length === 0) {
            btn.textContent = labelText;
        } else {
            btn.textContent = `${labelText} (${selectedValues.length})`;
        }
    }

    renderUI() {
        this.bindEvents();
    }

    bindEvents() {
        // 筛选事件
        const searchInput = this.container.querySelector(`#${this.idPrefix}-search`);
        
        if (searchInput) {
            const handleFilter = () => {
                this.filters.search = searchInput.value.toLowerCase();
                this.applyFilters();
            };
            searchInput.addEventListener('input', handleFilter);
        }
        
        // 初始化多选下拉框
        this.setupMultiSelects();

        // 点击外部关闭多选下拉框
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.multi-select-container')) {
                const dropdowns = this.container.querySelectorAll('.multi-select-dropdown');
                if(dropdowns) dropdowns.forEach(d => d.classList.remove('show'));
            }
        });

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
        const btnNew = this.container.querySelector(`#${this.idPrefix}-btn-new`);
        if(btnNew) btnNew.addEventListener('click', () => {
            if (this.onRequestNew) this.onRequestNew();
        });

        const btnExport = this.container.querySelector(`#${this.idPrefix}-btn-export`);
        if(btnExport) btnExport.addEventListener('click', () => {
            this.exportData();
        });

        const btnExportCurrent = this.container.querySelector(`#${this.idPrefix}-btn-export-current`);
        if(btnExportCurrent) btnExportCurrent.addEventListener('click', () => {
            this.exportFilteredData();
        });

        const fileImport = this.container.querySelector(`#${this.idPrefix}-file-import`);
        if(fileImport) fileImport.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importData(e.target.files[0]);
                e.target.value = ''; // 重置以便再次选择
            }
        });
    }

    // 获取经过部分筛选的敌人列表 (用于计算某一筛选项的可选值)
    getEnemiesFilteredBy(excludeKey) {
        return this.enemies.filter(enemy => {
            // 搜索
            if (this.filters.search && !enemy['名称'].toLowerCase().includes(this.filters.search)) return false;
            // 来源 (如果不是正在计算来源)
            if (excludeKey !== 'source' && this.filters.source.length > 0 && !this.filters.source.includes(enemy['来源'])) return false;
            // 位阶 (如果不是正在计算位阶)
            if (excludeKey !== 'tier' && this.filters.tier.length > 0 && !this.filters.tier.includes(String(enemy['位阶']))) return false;
            // 种类 (如果不是正在计算种类)
            if (excludeKey !== 'category' && this.filters.category.length > 0 && !this.filters.category.includes(enemy['种类'])) return false;
            return true;
        });
    }

    // 更新筛选下拉框 (来源、位阶、种类)
    updateSourceFilterOptions() {
        // 1. 更新来源
        const sourceSelect = this.container.querySelector(`#${this.idPrefix}-filter-source`);
        if (sourceSelect) {
            const filtered = this.getEnemiesFilteredBy('source');
            const sources = new Set();
            filtered.forEach(e => {
                if (e['来源']) sources.add(e['来源']);
            });
            
            // 清理已失效的筛选选项
            this.filters.source = this.filters.source.filter(val => sources.has(val));

            sourceSelect.innerHTML = '<option value="">所有来源</option>';
            
            Array.from(sources).sort().forEach(src => {
                const option = document.createElement('option');
                option.value = src;
                option.textContent = src;
                sourceSelect.appendChild(option);
            });
    
            // 刷新多选 UI
            this.refreshMultiSelectUI(`${this.idPrefix}-filter-source`, 'source', '来源');
        }

        // 2. 更新位阶
        const tierSelect = this.container.querySelector(`#${this.idPrefix}-filter-tier`);
        if (tierSelect) {
            const filtered = this.getEnemiesFilteredBy('tier');
            const tiers = new Set();
            filtered.forEach(e => {
                if (e['位阶'] !== undefined && e['位阶'] !== null) tiers.add(String(e['位阶']));
            });
            
            // 清理已失效的筛选选项
            this.filters.tier = this.filters.tier.filter(val => tiers.has(val));

            tierSelect.innerHTML = '<option value="">所有位阶</option>';
            
            // 按数值排序
            Array.from(tiers).sort((a, b) => parseInt(a) - parseInt(b)).forEach(t => {
                const option = document.createElement('option');
                option.value = t;
                option.textContent = t;
                tierSelect.appendChild(option);
            });
    
            // 刷新多选 UI
            this.refreshMultiSelectUI(`${this.idPrefix}-filter-tier`, 'tier', '位阶');
        }

        // 3. 更新种类
        const categorySelect = this.container.querySelector(`#${this.idPrefix}-filter-category`);
        if (categorySelect) {
            const filtered = this.getEnemiesFilteredBy('category');
            const categories = new Set();
            filtered.forEach(e => {
                if (e['种类']) categories.add(e['种类']);
            });
            
            // 清理已失效的筛选选项
            this.filters.category = this.filters.category.filter(val => categories.has(val));

            categorySelect.innerHTML = '<option value="">所有种类</option>';
            
            Array.from(categories).sort().forEach(c => {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                categorySelect.appendChild(option);
            });
    
            // 刷新多选 UI
            this.refreshMultiSelectUI(`${this.idPrefix}-filter-category`, 'category', '种类');
        }
    }

    applyFilters() {
        let result = this.enemies.filter(enemy => {
            // 搜索
            if (this.filters.search && !enemy['名称'].toLowerCase().includes(this.filters.search)) return false;
            // 来源
            if (this.filters.source.length > 0 && !this.filters.source.includes(enemy['来源'])) return false;
            // 位阶
            if (this.filters.tier.length > 0 && !this.filters.tier.includes(String(enemy['位阶']))) return false;
            // 种类
            if (this.filters.category.length > 0 && !this.filters.category.includes(enemy['种类'])) return false;
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
        this.updateSourceFilterOptions();
    }

    renderList() {
        const listContainer = this.container.querySelector(`#${this.idPrefix}-list`);
        const countLabel = this.container.querySelector(`#${this.idPrefix}-count`);
        
        if (!listContainer) return;

        listContainer.innerHTML = '';
        if (countLabel) countLabel.textContent = `(${this.filteredEnemies.length})`;

        this.filteredEnemies.forEach(enemy => {
            // 找到原始索引用于更新/删除
            const originalIndex = this.enemies.indexOf(enemy);
            
            const item = document.createElement('div');
            item.className = 'enemy-list-item';
            
            // 来源标记颜色
            const isCore = enemy['来源'] === '核心书';
            const isVoid = enemy['来源'] === 'VOID';
            const sourceClass = (isCore || isVoid) ? 'source-default' : 'source-custom';
            const sourceTitle = enemy['来源'] || '自定义';

            // 支持拖拽
            item.setAttribute('draggable', 'true');
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('application/json', JSON.stringify(enemy));
                e.dataTransfer.effectAllowed = 'copy';
            });

            item.innerHTML = `
                <div class="item-header">
                    <span class="item-name">${enemy['名称']}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <div class="source-tag ${sourceClass}" title="${sourceTitle}" style="position:static; margin:0;"></div>
                        <span class="item-tier">${enemy['来源'] || '自定义'}</span>
                        <span class="item-tier">位阶 ${enemy['位阶']}</span>
                        <span class="item-tier">${enemy['种类']}</span>
                        <button class="lib-item-delete" title="删除">×</button>
                    </div>
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
