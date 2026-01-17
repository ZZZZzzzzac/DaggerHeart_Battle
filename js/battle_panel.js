/**
 * 战斗面板逻辑
 */

class BattlePanel {
    constructor() {
        this.storageKey = 'trpg_battle_state';
        this.enemies = []; // { id: timestamp, data: enemyData }
        this.pcCount = 4;
        
        // DOM Elements
        this.battleArea = document.getElementById('battle-area');
        this.pcCountInput = document.getElementById('pc-count');
        this.budgetDisplay = document.getElementById('battle-budget');
        this.currentPointsDisplay = document.getElementById('current-points');
        this.emptyTip = document.querySelector('.empty-tip');
        
        // Editor Elements
        this.modal = document.getElementById('editor-modal');
        this.closeModal = document.querySelector('.close-modal');
        this.enemyForm = document.getElementById('enemyForm');
        
        this.editingId = null; // 当前正在编辑的卡片 ID

        this.init();
    }

    init() {
        this.loadState();
        this.bindEvents();
        this.render();
        this.updatePoints();

        // 初始化左侧敌人库 (复用 EnemyLibrary 类)
        // 我们不需要 library 的 onSelect 做什么，因为主要是拖拽
        this.library = new EnemyLibrary('library-wrapper', {
            onSelect: (enemyData) => {
                this.addEnemy(enemyData);
            },
            onRequestNew: () => {
                this.openEditorForLibrary(-1);
            },
            onRequestEdit: (enemyData, index) => {
                this.openEditorForLibrary(index, enemyData);
            }
        });
    }

    bindEvents() {
        // Toggle Library
        const toggleBtn = document.getElementById('toggle-library-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                document.body.classList.toggle('library-open');
                toggleBtn.textContent = document.body.classList.contains('library-open') ? '◀' : '▶';
            });
        }

        // PC 数量变化
        this.pcCountInput.addEventListener('change', (e) => {
            this.pcCount = parseInt(e.target.value) || 1;
            if (this.pcCount < 1) this.pcCount = 1;
            this.updatePoints();
            this.saveState();
        });

        // 拖放事件
        this.battleArea.addEventListener('dragover', (e) => {
            e.preventDefault(); // 允许放置
            this.battleArea.classList.add('drag-over');
        });

        this.battleArea.addEventListener('dragleave', () => {
            this.battleArea.classList.remove('drag-over');
        });

        this.battleArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.battleArea.classList.remove('drag-over');
            
            const jsonStr = e.dataTransfer.getData('application/json');
            if (jsonStr) {
                try {
                    const enemyData = JSON.parse(jsonStr);
                    this.addEnemy(enemyData);
                } catch (err) {
                    console.error('Invalid drop data', err);
                }
            }
        });

        // 战斗面板上的右键编辑 (通过事件冒泡监听 enemy_card.js 发出的事件)
        this.battleArea.addEventListener('edit-enemy', (e) => {
            const { enemyData, cardElement } = e.detail;
            // 找到对应的内部数据对象
            const instance = this.enemies.find(item => item.data === enemyData);
            if (instance) {
                this.openEditorForBattle(instance.id, enemyData);
            }
        });

        // 监听卡片内部状态更新 (HP/Stress/Note) 以便保存状态
        this.battleArea.addEventListener('card-update', () => {
            this.saveState();
        });

        // 清空按钮
        document.getElementById('btn-clear-battle').addEventListener('click', () => {
            if (confirm('确定要清空战斗面板吗？')) {
                this.enemies = [];
                this.render();
                this.saveState();
                this.updatePoints();
            }
        });

        // 导出按钮
        document.getElementById('btn-export-battle').addEventListener('click', () => {
            this.exportState();
        });

        // 导入按钮
        document.getElementById('file-import-battle').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importState(e.target.files[0]);
                e.target.value = '';
            }
        });

        // 模态框关闭
        this.closeModal.addEventListener('click', () => {
            this.modal.style.display = 'none';
        });
        window.addEventListener('click', (event) => {
            if (event.target == this.modal) {
                this.modal.style.display = "none";
            }
        });

        // 绑定表单提交
        if (this.enemyForm) {
            this.enemyForm.addEventListener('submit', (e) => {
                // 防止默认提交（如果 enemy_editor.js 没有绑定的话）
                e.preventDefault();
                
                if (typeof window.collectEnemyEditorData !== 'function') {
                    console.error('collectEnemyEditorData function not found');
                    return;
                }

                const newData = window.collectEnemyEditorData();

                // 区分是 Library 还是 Battle 编辑
                if (this.editContext === 'library') {
                    this.library.saveEnemy(newData, this.editIndex);
                } else if (this.editContext === 'battle') {
                    this.updateEnemyInBattle(this.editId, newData);
                }

                this.modal.style.display = 'none';
            });
        }
    }

    // --- 数据管理 ---

    loadState() {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const state = JSON.parse(stored);
                this.enemies = state.enemies || [];
                this.pcCount = state.pcCount || 4;
                this.pcCountInput.value = this.pcCount;
            } catch (e) {
                console.error('Failed to load battle state', e);
                this.enemies = [];
            }
        }
    }

    saveState() {
        const state = {
            enemies: this.enemies,
            pcCount: this.pcCount
        };
        localStorage.setItem(this.storageKey, JSON.stringify(state));
        this.updatePoints();
    }

    addEnemy(enemyData) {
        // 深拷贝数据，确保卡片独立
        const clone = JSON.parse(JSON.stringify(enemyData));
        // 添加唯一 ID
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
        
        this.enemies.push({ id, data: clone });
        this.render();
        this.saveState();
    }

    removeEnemy(id) {
        const index = this.enemies.findIndex(e => e.id === id);
        if (index !== -1) {
            this.enemies.splice(index, 1);
            this.render();
            this.saveState();
        }
    }

    updateEnemyInBattle(id, newData) {
        const index = this.enemies.findIndex(e => e.id === id);
        if (index !== -1) {
            // 保留运行时状态 (如当前 HP)
            const oldData = this.enemies[index].data;
            newData._note = oldData._note;
            newData._currentHp = Math.min(newData['生命点'], oldData._currentHp || 0); // 防止溢出
            newData._currentStress = Math.min(newData['压力点'], oldData._currentStress || 0);

            this.enemies[index].data = newData;
            this.render();
            this.saveState();
        }
    }

    // --- 渲染与计算 ---

    render() {
        this.battleArea.innerHTML = '';
        if (this.enemies.length === 0) {
            this.battleArea.appendChild(this.emptyTip);
            return;
        }

        this.enemies.forEach(instance => {
            const wrapper = document.createElement('div');
            wrapper.className = 'battle-card-wrapper';
            
            // 渲染卡片
            const card = renderEnemyCard(instance.data);
            wrapper.appendChild(card);

            // 添加删除按钮
            const closeBtn = document.createElement('button');
            closeBtn.className = 'card-close-btn';
            closeBtn.innerHTML = '×';
            closeBtn.title = '移除敌人';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // 防止触发卡片上的事件
                this.removeEnemy(instance.id);
            });
            wrapper.appendChild(closeBtn);

            this.battleArea.appendChild(wrapper);
        });
    }

    updatePoints() {
        const budget = (3 * this.pcCount) + 2;
        this.budgetDisplay.textContent = `战斗点数: ${budget}`;

        let totalPoints = 0;
        let minionCount = 0;

        this.enemies.forEach(inst => {
            const cat = (inst.data['种类'] || '').trim();
            if (cat === '杂兵') {
                minionCount++;
            } else if (['社交', '辅助'].includes(cat)) {
                totalPoints += 1;
            } else if (['集群', '远程', '潜伏', '标准'].includes(cat)) {
                totalPoints += 2;
            } else if (cat === '头目') {
                totalPoints += 3;
            } else if (cat === '斗士') {
                totalPoints += 4;
            } else if (cat === '独狼') {
                totalPoints += 5;
            } else {
                // 默认为标准
                totalPoints += 2;
            }
        });

        // 计算杂兵点数: PC数个杂兵 = 1点 (即每个杂兵 1/PC 点)
        if (minionCount > 0) {
            totalPoints += (minionCount / this.pcCount);
        }

        const displayPoints = Number.isInteger(totalPoints) ? totalPoints : totalPoints.toFixed(2);
        
        this.currentPointsDisplay.textContent = `当前: ${displayPoints}`;
        
        if (totalPoints > budget) {
            this.currentPointsDisplay.style.color = '#e03131'; // Red
        } else {
            this.currentPointsDisplay.style.color = '#2f9e44'; // Green
        }
    }

    // --- 编辑器控制 ---

    openEditorForLibrary(index, data = {}) {
        this.editContext = 'library';
        this.editIndex = index;
        if (index === -1) {
            resetEditor();
        } else {
            fillEditor(data);
        }
        this.modal.style.display = 'block';
    }

    openEditorForBattle(id, data) {
        this.editContext = 'battle';
        this.editId = id;
        fillEditor(data);
        this.modal.style.display = 'block';
    }

    // --- 导入导出 ---
    
    exportState() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.enemies, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "battle_panel_export.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    importState(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (Array.isArray(importedData)) {
                    // 验证数据结构
                    const validData = importedData.filter(item => item.id && item.data);
                    if (validData.length > 0) {
                        // 清理旧 source
                        validData.forEach(item => {
                            if (item.data && item.data.source) delete item.data.source;
                        });
                        
                        this.enemies = validData;
                        this.render();
                        this.saveState();
                        alert(`成功导入 ${validData.length} 个敌人`);
                    } else {
                        alert('导入数据格式不正确（必须包含 id 和 data 字段）');
                    }
                } else {
                    alert('导入文件格式错误：必须是数组');
                }
            } catch (e) {
                alert('导入失败：JSON 解析错误');
                console.error(e);
            }
        };
        reader.readAsText(file);
    }
}

// 辅助函数
function fillEditor(data) {
    const setValue = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    setValue('name', data['名称']);
    setValue('tier', data['位阶']);
    setValue('category', data['种类']);
    setValue('source', data['来源']);
    setValue('intro', data['简介']);
    setValue('tactics', data['动机与战术']);
    setValue('experiences', data['经历']);
    setValue('difficulty', data['难度']);
    setValue('hp', data['生命点']);
    setValue('stress', data['压力点']);
    setValue('majorThreshold', data['重度伤害阈值']);
    setValue('severeThreshold', data['严重伤害阈值']);
    setValue('attackHit', data['攻击命中']);
    setValue('attackWeapon', data['攻击武器']);
    setValue('attackRange', data['攻击范围']);
    setValue('attackDamage', data['攻击伤害']);
    setValue('attackAttr', data['攻击属性']);

    const traitsContainer = document.getElementById('traitsContainer');
    const addTraitBtn = document.getElementById('addTraitBtn');
    traitsContainer.innerHTML = '';
    
    if (data['特性']) {
        data['特性'].forEach(trait => {
            addTraitBtn.click();
            const items = traitsContainer.querySelectorAll('.trait-item');
            const newItem = items[items.length - 1];
            if (newItem) {
                newItem.querySelector('.trait-name').value = trait['名称'] || '';
                newItem.querySelector('.trait-type').value = trait['类型'] || '';
                newItem.querySelector('.trait-desc').value = trait['特性描述'] || '';
            }
        });
    }
}

function resetEditor() {
    document.getElementById('enemyForm').reset();
    document.getElementById('traitsContainer').innerHTML = '';
    const addTraitBtn = document.getElementById('addTraitBtn');
    if(addTraitBtn) addTraitBtn.click(); 
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.battleApp = new BattlePanel();
});
