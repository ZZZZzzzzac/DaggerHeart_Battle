/**
 * 环境卡片模块
 * 负责渲染环境卡片 DOM 及处理卡片内部交互
 */

// 渲染环境卡片
function renderEnvironmentCard(envData) {
    const card = document.createElement('div');
    card.className = 'enemy-card environment-card'; // 复用 enemy-card 样式，同时添加 specific class
    
    // 初始化临时状态数据
    if (typeof envData._note === 'undefined') envData._note = '';

    // 构建 HTML 结构
    const introHtml = envData['简介'] ? `<div class="card-intro">${envData['简介']}</div>` : '';
    const tendencyHtml = envData['趋向'] ? `<div class="card-tactics"><strong>趋向：</strong>${envData['趋向']}</div>` : '';
    const potentialEnemiesHtml = envData['潜在敌人'] ? `<div class="experience-row"><strong>潜在敌人：</strong>${envData['潜在敌人']}</div>` : '';

    const headerHtml = `
        <div class="card-header">
            <div class="card-title">
                <span>${envData['名称'] || '未命名'}</span>
                <div class="card-meta">位阶 ${envData['位阶'] || '1'} ${envData['种类'] || '险境'} </div>
            </div>
            ${introHtml}
            ${tendencyHtml}
            ${potentialEnemiesHtml}
        </div>
    `;

    // 状态部分 (只有难度)
    const statsHtml = `
        <div class="defense-section" style="justify-content: flex-start; gap: 20px;">
            <div class="stat-row">
                <div class="stat-item">
                    <span class="stat-label">难度</span>
                    <span class="stat-value">${envData['难度'] || '-'}</span>
                </div>
            </div>
        </div>
    `;

    // 特性部分
    const traitsContainer = document.createElement('div');
    traitsContainer.className = 'traits-section';
    if (envData['特性'] && Array.isArray(envData['特性'])) {
        envData['特性'].forEach(trait => {
            const traitCard = document.createElement('div');
            traitCard.className = 'trait-card';
            
            let questionHtml = '';
            if (trait['特性问题']) {
                questionHtml = `<div class="trait-question" style="margin-top:4px; font-style:italic; color:#666;">${parseMarkdown(trait['特性问题'])}</div>`;
            }

            traitCard.innerHTML = `
                <div class="trait-header">
                    <span class="trait-name">${trait['名称']}</span>
                    <span class="trait-type">${trait['类型']}</span>
                </div>
                <div class="trait-desc">${parseMarkdown(trait['特性描述'])}</div>
                ${questionHtml}
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
            <textarea class="note-input" placeholder="备注...">${envData._note || ''}</textarea>
        </div>
    `;

    // 组装卡片
    // 环境卡没有攻击部分
    card.innerHTML = headerHtml + statsHtml;
    card.appendChild(traitsContainer);
    card.insertAdjacentHTML('beforeend', noteHtml);

    // --- 逻辑绑定 ---

    // 备注输入
    const noteInput = card.querySelector('.note-input');
    noteInput.addEventListener('input', (e) => {
        envData._note = e.target.value;
        dispatchUpdate(card);
    });

    // 右键编辑
    card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        // 触发自定义事件 'edit-enemy' (或新建 edit-environment)，冒泡给上层处理
        // 注意：BattlePanel 监听的是 'edit-enemy'。
        // 如果想复用逻辑，可能需要 BattlePanel 判断数据类型。
        // 这里我们依然触发 'edit-enemy'，但在 detail 中带上数据，BattlePanel 会根据数据结构（如是否有“潜在敌人”字段）来决定打开哪个编辑器。
        const event = new CustomEvent('edit-enemy', {
            bubbles: true,
            detail: { enemyData: envData, cardElement: card }
        });
        card.dispatchEvent(event);
    });

    return card;
}

// 辅助函数 (如果 enemy_card.js 已定义，这里可以不定义，但为了安全起见检查一下)
// 注意：在浏览器环境中，如果这些函数已存在于 window，重新定义可能会报错或覆盖。
// 为了避免冲突，我们只定义如果不存在。
// 但 const/function 在同一作用域下不能重复声明。
// 由于 script 标签加载，它们在同一全局作用域。
// 最好的办法是不重复定义，直接使用。
// 假设 enemy_card.js 已经加载。

// 如果需要独立运行，可以取消下面的注释，或者重命名函数。

// function parseMarkdown(text) {
//     if (!text) return '';
//     let html = text.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, "\"").replace(/'/g, "&#039;");
//     html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>');
//     html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
//     html = html.replace(/\*(.+?)\*/g, '<i>$1</i>');
//     return html;
// }

// function dispatchUpdate(element) {
//     element.dispatchEvent(new CustomEvent('card-update', { bubbles: true }));
// }

