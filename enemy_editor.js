document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('enemyForm');
    const traitsContainer = document.getElementById('traitsContainer');
    const addTraitBtn = document.getElementById('addTraitBtn');
    const traitTemplate = document.getElementById('traitTemplate');
    const clearBtn = document.getElementById('clearBtn');

    // 添加特性
    addTraitBtn.addEventListener('click', () => {
        const clone = traitTemplate.content.cloneNode(true);
        traitsContainer.appendChild(clone);
    });

    // 删除特性 (事件委托)
    traitsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-trait')) {
            e.target.closest('.trait-item').remove();
        }
    });

    // 清空表单
    clearBtn.addEventListener('click', () => {
        if(confirm('确定要清空所有内容吗？')) {
            form.reset();
            traitsContainer.innerHTML = '';
            // 清空后添加一个默认的空特性
            addTraitBtn.click();
        }
    });

    // 提交表单 (生成 JSON)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const enemyData = {
            "名称": formData.get('名称') || "",
            "原文": "",
            "位阶": formData.get('位阶') || "",
            "种类": formData.get('种类') || "",
            "特性": [],
            "类型": "敌人",
            "简介": formData.get('简介') || "",
            "动机与战术": formData.get('动机与战术') || "",
            "难度": formData.get('难度') || "",
            "重度伤害阈值": formData.get('重度伤害阈值') || "",
            "严重伤害阈值": formData.get('严重伤害阈值') || "",
            "生命点": formData.get('生命点') || "",
            "压力点": formData.get('压力点') || "",
            "攻击命中": formData.get('攻击命中') || "",
            "攻击武器": formData.get('攻击武器') || "",
            "攻击范围": formData.get('攻击范围') || "",
            "攻击伤害": formData.get('攻击伤害') || "",
            "攻击属性": formData.get('攻击属性') || "",
            "经历": formData.get('经历') || ""
        };

        // 处理特性
        const traitItems = traitsContainer.querySelectorAll('.trait-item');
        traitItems.forEach(item => {
            const trait = {
                "名称": item.querySelector('.trait-name').value || "",
                "原名": "",
                "类型": item.querySelector('.trait-type').value || "",
                "特性描述": item.querySelector('.trait-desc').value || ""
            };
            // 只有当特性有名称时才添加
            if (trait["名称"]) {
                enemyData["特性"].push(trait);
            }
        });

        console.log(JSON.stringify(enemyData, null, 4));
        alert('JSON 已生成并在控制台输出 (F12 查看)');
    });
    
    // 初始化添加一个特性框
    addTraitBtn.click();
});