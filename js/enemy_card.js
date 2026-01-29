/**
 * 敌人卡片模块
 * 负责渲染敌人卡片 DOM 及处理卡片内部交互
 */

// 渲染敌人卡片
function renderEnemyCard(enemyData) {
    const card = document.createElement('div');
    card.className = 'enemy-card';
    
    // 初始化临时状态数据 (如果数据源中没有)
    if (typeof enemyData._currentHp === 'undefined') enemyData._currentHp = 0;
    if (typeof enemyData._currentStress === 'undefined') enemyData._currentStress = 0;
    if (typeof enemyData._note === 'undefined') enemyData._note = '';

    // 解析数值
    const maxHp = parseInt(enemyData['生命点']) || 0;
    const maxStress = parseInt(enemyData['压力点']) || 0;
    
    // 构建 HTML 结构
    const introHtml = enemyData['简介'] ? `<div class="card-intro">${enemyData['简介']}</div>` : '';
    const tacticsHtml = enemyData['动机与战术'] ? `<div class="card-tactics"><strong>动机与战术：</strong>${enemyData['动机与战术']}</div>` : '';

    const headerHtml = `
        <div class="card-header">
            <div class="card-title">
                <span>${enemyData['名称'] || '未命名'}</span>
                <div class="card-meta">位阶 ${enemyData['位阶'] || '1'} ${enemyData['种类'] || '标准'} </div>
            </div>
            ${introHtml}
            ${tacticsHtml}
        </div>
    `;

    // 防御部分 (合并数值与状态点)
    const hpRowHtml = maxHp > 0 ? `
        <div class="point-row" id="hp-row-${Date.now()}-${Math.random()}">
            <span class="point-label">生命</span>
            <div class="checkbox-container hp-container"></div>
        </div>` : '';

    const stressRowHtml = maxStress > 0 ? `
        <div class="point-row" id="stress-row-${Date.now()}-${Math.random()}">
            <span class="point-label">压力</span>
            <div class="checkbox-container stress-container"></div>
        </div>` : '';

    const experienceHtml = enemyData['经历'] ? `
        <div class="experience-row">
            <strong>经历：</strong>${enemyData['经历']}
        </div>` : '';

    const defenseHtml = `
        <div class="defense-section">
            <div class="stat-row">
                <div class="stat-item">
                    <span class="stat-label">难度</span>
                    <span class="stat-value">${enemyData['难度'] || '-'}</span>
                </div>
                <div class="stat-item stat-item-right">
                    <span class="stat-label">阈值</span>
                    <div class="thresholds">
                        <span title="重度">${enemyData['重度伤害阈值'] || '-'}</span>
                        <span class="threshold-separator">/</span>
                        <span title="严重">${enemyData['严重伤害阈值'] || '-'}</span>
                    </div>
                </div>
            </div>
            
            <div class="points-section">
                ${hpRowHtml}
                ${stressRowHtml}
            </div>

            ${experienceHtml}
        </div>
    `;

    // 攻击部分
    const hasAttack = enemyData['攻击命中'] || enemyData['攻击武器'] || enemyData['攻击范围'] || enemyData['攻击伤害'] || enemyData['攻击属性'];
    const attackHtml = hasAttack ? `
        <div class="attack-section">
            <div class="attack-content">
                攻击${enemyData['攻击命中'] || '-'} <span class="attack-separator">|</span>
                ${enemyData['攻击武器'] || '-'}: ${enemyData['攻击范围'] || '-'} <span class="attack-separator">|</span>
                ${enemyData['攻击伤害'] || '-'} ${enemyData['攻击属性'] || '-'}
            </div>
        </div>
    ` : '';

    // 特性部分
    const traitsContainer = document.createElement('div');
    traitsContainer.className = 'traits-section';
    if (enemyData['特性'] && Array.isArray(enemyData['特性'])) {
        enemyData['特性'].forEach(trait => {
            const traitCard = document.createElement('div');
            traitCard.className = 'trait-card';
            traitCard.innerHTML = `
                <div class="trait-header">
                    <span class="trait-name">${trait['名称']}</span>
                    <span class="trait-type">${trait['类型']}</span>
                </div>
                <div class="trait-desc">${parseMarkdown(trait['特性描述'])}</div>
            `;
            // 点击展开/收起
            traitCard.addEventListener('click', () => {
                traitCard.classList.toggle('expanded');
            });
            traitsContainer.appendChild(traitCard);
        });
    }

    // 备注部分
    const noteHtml = `
        <div class="note-section">
            <textarea class="note-input" placeholder="备注...">${enemyData._note || ''}</textarea>
        </div>
    `;

    // 组装卡片
    card.innerHTML = headerHtml + defenseHtml + attackHtml;
    card.appendChild(traitsContainer);
    card.insertAdjacentHTML('beforeend', noteHtml);

    // --- 逻辑绑定 ---

    // 1. 生命点 Checkbox
    if (maxHp > 0) {
        const hpContainer = card.querySelector('.hp-container');
        if (hpContainer) {
            renderCheckboxes(hpContainer, maxHp, enemyData._currentHp, 'filled', (newVal) => {
                enemyData._currentHp = newVal;
                // 可以在这里触发数据保存事件
                dispatchUpdate(card);
            });
        }
    }

    // 2. 压力点 Checkbox
    if (maxStress > 0) {
        const stressContainer = card.querySelector('.stress-container');
        if (stressContainer) {
            renderCheckboxes(stressContainer, maxStress, enemyData._currentStress, 'stress-filled', (newVal) => {
                enemyData._currentStress = newVal;
                dispatchUpdate(card);
            });
        }
    }

    // 3. 备注输入
    const noteInput = card.querySelector('.note-input');
    noteInput.addEventListener('input', (e) => {
        enemyData._note = e.target.value;
        dispatchUpdate(card);
    });

    // 4. 右键编辑
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // 触发自定义事件 'edit-enemy'，冒泡给上层处理
        const event = new CustomEvent('edit-enemy', {
            bubbles: true,
            detail: { enemyData: enemyData, cardElement: card }
        });
        card.dispatchEvent(event);
    });

    return card;
}

/**
 * 渲染复选框组
 * @param {HTMLElement} container 容器
 * @param {number} total 总数
 * @param {number} current 当前值
 * @param {string} activeClass 激活时的类名
 * @param {Function} onChange 回调函数 (newValue) => {}
 */
function renderCheckboxes(container, total, current, activeClass, onChange) {
    container.innerHTML = ''; // 清空
    for (let i = 1; i <= total; i++) {
        const box = document.createElement('div');
        box.className = 'point-checkbox';
        if (i <= current) {
            box.classList.add(activeClass);
        }
        
        box.addEventListener('click', () => {
            let newValue = i;
            // 如果点击的是当前最大值，则取消选中它（减少1）
            if (i === current) {
                newValue = i - 1;
            }
            // 更新 UI
            renderCheckboxes(container, total, newValue, activeClass, onChange);
            // 触发回调
            onChange(newValue);
        });
        
        container.appendChild(box);
    }
}

// 辅助：触发更新事件
function dispatchUpdate(element) {
    element.dispatchEvent(new CustomEvent('card-update', { bubbles: true }));
}

/**
 * 简单的 Markdown 解析 (支持粗体和斜体)
 */
function parseMarkdown(text) {
    if (!text) return '';
    // 1. HTML 转义 (防止 XSS)
    let html = text.replace(/&/g, "&")
                   .replace(/</g, "<")
                   .replace(/>/g, ">")
                   .replace(/"/g, "\"")
                   .replace(/'/g, "&#039;");

    // 2. Markdown 替换
    // ***粗斜体***
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
    // **粗体**
    html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    // *斜体*
    html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
    // 换行
    html = html.replace(/\n/g, '<br>');
    
    return html;
}

// 导出函数 (如果在模块化环境中)
// window.renderEnemyCard = renderEnemyCard;
