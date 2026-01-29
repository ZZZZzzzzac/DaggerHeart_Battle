
const ENVIRONMENT_TRAIT_LIBRARY = [
    {
        name: "通用特性",
        type: "被动",
        desc: "这是一个通用特性。",
        question: "*这是一个通用特性的问题？*"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    // 假设 HTML 中会有对应的 ID，遵循 env 前缀或类似约定
    // 暂时定义这些 ID，后续需要在 HTML 中创建对应元素
    const form = document.getElementById('environmentForm');
    const traitsContainer = document.getElementById('envTraitsContainer');
    const addTraitBtn = document.getElementById('addEnvTraitBtn');
    const traitTemplate = document.getElementById('envTraitTemplate');
    const clearBtn = document.getElementById('clearEnvBtn');

    if (!form) return; // 如果找不到表单，说明当前页面可能还没准备好环境编辑器的 HTML

    // 初始化特性项（填充 select 等）
    function initTraitItem(item) {
        const select = item.querySelector('.trait-name-select');
        if (select) {
            // 填充选项
            ENVIRONMENT_TRAIT_LIBRARY.forEach(trait => {
                const option = document.createElement('option');
                option.value = trait.name;
                option.textContent = trait.name;
                select.appendChild(option);
            });

            // 绑定事件
            select.addEventListener('change', function() {
                const traitName = this.value;
                const traitData = ENVIRONMENT_TRAIT_LIBRARY.find(t => t.name === traitName);
                if (traitData) {
                    item.querySelector('.trait-name').value = traitData.name;
                    item.querySelector('.trait-type').value = traitData.type;
                    item.querySelector('.trait-desc').value = traitData.desc;
                    // 处理特性问题
                    const questionInput = item.querySelector('.trait-question');
                    if (questionInput) {
                        questionInput.value = traitData.question || "";
                    }
                }
                // 重置 select 选中项
                this.selectedIndex = 0;
            });
        }
    }

    // 添加特性
    addTraitBtn.addEventListener('click', () => {
        const clone = traitTemplate.content.cloneNode(true);
        const item = clone.querySelector('.trait-item');
        initTraitItem(item);
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

    // 暴露数据收集函数
    window.collectEnvironmentEditorData = function() {
        const formData = new FormData(form);
        const envData = {
            "名称": formData.get('名称') || "",
            "原文": "",
            "位阶": formData.get('位阶') || "",
            "种类": formData.get('种类') || "",
            "来源": formData.get('来源') || "自定义",
            "特性": [],
            "类型": "环境", // 固定类型
            "简介": formData.get('简介') || "",
            "趋向": formData.get('趋向') || "",
            "难度": formData.get('难度') || "",
            "潜在敌人": formData.get('潜在敌人') || ""
        };

        // 处理特性
        const traitItems = traitsContainer.querySelectorAll('.trait-item');
        traitItems.forEach(item => {
            const trait = {
                "名称": item.querySelector('.trait-name').value || "",
                "原名": "",
                "类型": item.querySelector('.trait-type').value || "",
                "特性描述": item.querySelector('.trait-desc').value || "",
                "特性问题": item.querySelector('.trait-question') ? item.querySelector('.trait-question').value : ""
            };
            // 只有当特性有名称时才添加
            if (trait["名称"]) {
                envData["特性"].push(trait);
            }
        });
        
        return envData;
    };
    
    // 初始化添加一个特性框
    if (addTraitBtn) {
        addTraitBtn.click();
    }
});
