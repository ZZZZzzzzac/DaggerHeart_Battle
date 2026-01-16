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
        // 但我们可以允许右键编辑库里的模版
        this.library = new EnemyLibrary('library-wrapper', {
            onSelect: (enemyData) => {
                // 可选：点击库里的项，可以高亮或者做点什么
                console.log('Selected in library:', enemyData['名称']);
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
        // 注意：因为 Library 和 Battle 共用一个 Form，我们需要区分当前是为谁提交
        // 我们使用一个 currentSubmitHandler 变量来动态切换，或者在提交时检查状态
        if (this.enemyForm) {
            // 移除可能存在的旧监听器 (如果是重新加载脚本的话)，但这里我们只添加一次
            // 为了避免冲突，我们可以在 openEditor 时重新赋值 form.onsubmit，或者在这里统一处理
            
            this.enemyForm.addEventListener('submit', (e) => {
                // 获取表单数据 (复用 enemy_library.html 中的逻辑)
                // 这里我们手动收集，或者调用一个辅助函数
                const formData = new FormData(this.enemyForm);
                const newData = {
                    "名称": formData.get('名称'),
                    "位阶": formData.get('位阶'),
                    "种类": formData.get('种类'),
                    "来源": formData.get('来源'),
                    "简介": formData.get('简介'),
                    "动机与战术": formData.get('动机与战术'),
                    "经历": formData.get('经历'),
                    "难度": formData.get('难度'),
                    "生命点": formData.get('生命点'),
                    "压力点": formData.get('压力点'),
                    "重度伤害阈值": formData.get('重度伤害阈值'),
                    "严重伤害阈值": formData.get('严重伤害阈值'),
                    "攻击命中": formData.get('攻击命中'),
                    "攻击武器": formData.get('攻击武器'),
                    "攻击范围": formData.get('攻击范围'),
                    "攻击伤害": formData.get('攻击伤害'),
                    "攻击属性": formData.get('攻击属性'),
                    "特性": []
                };

                const traitItems = document.getElementById('traitsContainer').querySelectorAll('.trait-item');
                traitItems.forEach(item => {
                    const name = item.querySelector('.trait-name').value;
                    if (name) {
                        newData['特性'].push({
                            '名称': name,
                            '类型': item.querySelector('.trait-type').value,
                            '特性描述': item.querySelector('.trait-desc').value
                        });
                    }
                });

                // 区分是 Library 还是 Battle 编辑
                if (this.editContext === 'library') {
                    this.library.saveEnemy(newData, this.editIndex);
                    // 库的保存会自动重绘库列表
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
            // 保留原有的一些运行时状态 (如当前 HP) 如果需要的话
            // 但通常编辑意味着重置或者完全覆盖。
            // 考虑到编辑可能改了最大HP，最好是保留比例或者直接重置？
            // 简单起见，保留 note，其他覆盖
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
        this.budgetDisplay.textContent = `预算: ${budget}`;

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

        // 计算杂兵点数: PC数个杂兵 = 1点
        if (minionCount > 0) {
            totalPoints += (minionCount / this.pcCount);
        }

        // 格式化显示 (如果是整数则显示整数，否则保留2位小数)
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

// 辅助函数 (从 enemy_library.html 移动过来的逻辑，因为现在 library.html 的脚本不在 index.html 中)
// 我们需要确保这些函数是全局可用的，或者作为 BattlePanel 的方法
// 为了兼容 enemy_library.html 中的原有逻辑，我们可以把它们放在全局

function fillEditor(data) {
    document.getElementById('name').value = data['名称'] || '';
    document.getElementById('tier').value = data['位阶'] || '';
    document.getElementById('category').value = data['种类'] || '';
    document.getElementById('source').value = data['来源'] || ''; // 注意：HTML模板里可能有也可能没有这个字段，需要检查
    document.getElementById('intro').value = data['简介'] || '';
    document.getElementById('tactics').value = data['动机与战术'] || '';
    document.getElementById('experiences').value = data['经历'] || '';
    document.getElementById('difficulty').value = data['难度'] || '';
    document.getElementById('hp').value = data['生命点'] || '';
    document.getElementById('stress').value = data['压力点'] || '';
    document.getElementById('majorThreshold').value = data['重度伤害阈值'] || '';
    document.getElementById('severeThreshold').value = data['严重伤害阈值'] || '';
    document.getElementById('attackHit').value = data['攻击命中'] || '';
    document.getElementById('attackWeapon').value = data['攻击武器'] || '';
    document.getElementById('attackRange').value = data['攻击范围'] || '';
    document.getElementById('attackDamage').value = data['攻击伤害'] || '';
    document.getElementById('attackAttr').value = data['攻击属性'] || '';

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
    document.getElementById('addTraitBtn').click(); 
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.battleApp = new BattlePanel();
});
