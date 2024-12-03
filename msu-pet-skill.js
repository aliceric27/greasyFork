// ==UserScript==
// @name         MSU 寵物技能快快出
// @namespace    http://tampermonkey.net/
// @version      0.8
// @author       Alex from MyGOTW
// @description  擷取 MSU.io 寵物技能
// @match        https://msu.io/marketplace/*
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==
 
(function() {
    'use strict';
 
    // 追蹤已處理過的 tokenID
    const processedTokens = new Set();
 
    // 定義要篩選的技能
const skillTranslations = {
    'Item Pouch': '拾取道具',
    'NESO Magnet': '撿拾NESO',
    'Auto HP Potion Pouch': '自動使用HP藥水',
    'Auto MP Potion Pouch': '自動使用MP藥水',
    'Auto Move': '自動移動',
    'Expanded Auto Move': '擴大自動移動範圍',
    'Fatten Up': '巨大化技能',
    'Auto Buff': '自動施放加持技能',
    'Pet Training Skill': '親密度提升',
    'Magnet Effect': '磁力效果'
};
 
// 新增翻譯函數
function translateSkill(skill) {
    return skillTranslations[skill] || skill;
}
 
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const [resource, config] = args;
 
        if (resource.includes('/marketplace/api/marketplace/explore/items')) {
            console.log('請求參數:', {
                url: resource,
                body: JSON.parse(config.body)
            });
 
            try {
                const response = await originalFetch(resource, config);
                const clone = response.clone();
 
                clone.json().then(async data => {
                    console.log('物品資料:', data);
                    if (data.items) {
                        let AllToken = [];
                        let allData = [];
 
                        // 篩選出未處理過的 tokenID
                        AllToken = data.items
                            .map(item => item.tokenId)
                            .filter(tokenId => !processedTokens.has(tokenId));
                            
                        console.log('未處理的 Token:', AllToken);
 
                        // 對每個未處理的 tokenID 發送 API 請求
                        for (const tokenId of AllToken) {
                            try {
                                console.log('開始抓資料啦')
                                await delay(50);
                                const response = await originalFetch(`https://msu.io/marketplace/api/marketplace/items/${tokenId}`);
                                const itemData = await response.json();
                                allData.push(itemData);
 
                                if (itemData.item && itemData.item.pet) {
                                    const petSkills = itemData.item.pet.petSkills || [];
                                    const mintingNo = itemData.tokenInfo?.mintingNo;
                                    const fullPetName = `${itemData.item.name} #${mintingNo}`;
 
                                    await tryFindAndInsertSkills(fullPetName, petSkills);
                                }
                                
                                processedTokens.add(tokenId);
                            } catch (error) {
                                console.error(`無法獲取 tokenID ${tokenId} 的資料:`, error);
                            }
                        }
                        console.log('allData', allData);
                        
                        // 在所有資料處理完後，創建或更新過濾面板
                        await delay(500); // 等待DOM更新
                        if (!document.querySelector('.skill-filter')) {
                            createFilterPanel();
                        }
                    }
                });
 
                return response;
            } catch (error) {
                console.error('請求錯誤:', error);
                throw error;
            }
        }
 
        return originalFetch(resource, config);
    };
 
    // 新增延遲函數
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
 
    // 新增重試函數
    async function tryFindAndInsertSkills(fullPetName, petSkills, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            const allNameElements = document.querySelectorAll('span[class*="msuui_"][class*="_1rn3yq42"]');
            let found = false;

            for (const element of allNameElements) {
                if (element.textContent.includes(fullPetName)) {
                    const parentDiv = element.closest('div[class*="_14ahg4pm"]');
                    if (parentDiv) {
                        const targetDiv = parentDiv.querySelector('div[class*="_14ahg4pp"]');
                        const existingSkills = targetDiv?.querySelector('.pet-skills-info');
                        
                        if (!existingSkills && targetDiv) {
                            const skillsDiv = document.createElement('div');
                            skillsDiv.className = 'pet-skills-info';
                            skillsDiv.style.cssText = `
                                font-size: 12px;
                                color: #FFF;
                                margin-top: 5px;
                                padding: 5px;
                                z-index: 1;
                                background-color: black;
                            `;
                            skillsDiv.textContent = `技能: ${petSkills.map(skill => translateSkill(skill)).join(', ')}`;
                            targetDiv.appendChild(skillsDiv);
                            found = true;
                            break;
                        }
                    }
                }
            }

            if (found) break;
            
            // 如果沒找到，等待1秒後重試
            await delay(1000);
        }
    }

    // 在 skillTranslations 後面加入
    const filterStyles = `
        .skill-filter {
            position: fixed;
            left: -180px;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(0, 0, 0, 0.8);
            padding: 15px;
            border-radius: 0 8px 8px 0;
            z-index: 1000;
            color: white;
            width: 200px;
            transition: left 0.3s ease;
        }
        .skill-filter:hover {
            left: 0;
        }
        .skill-filter h3 {
            margin: 0 0 10px 0;
            color: white;
            padding-left: 10px;
            border-left: 3px solid #fff;
        }
        .skill-filter label {
            display: block;
            margin: 5px 0;
            cursor: pointer;
            padding: 5px;
            transition: background-color 0.2s;
        }
        .skill-filter label:hover {
            background-color: rgba(255, 255, 255, 0.1);
        }
        .skill-filter input[type="checkbox"] {
            margin-right: 8px;
        }
        .skill-filter::after {
            content: "▶";
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0.7;
            font-size: 12px;
        }
        .skill-filter:hover::after {
            opacity: 0;
        }
    `;

    // 在 window.fetch 之前加入
    function createFilterPanel() {
        // 添加樣式
        const styleSheet = document.createElement('style');
        styleSheet.textContent = filterStyles;
        document.head.appendChild(styleSheet);

        // 創建過濾面板
        const filterDiv = document.createElement('div');
        filterDiv.className = 'skill-filter';
        filterDiv.innerHTML = `
            <h3>技能過濾</h3>
            ${Object.entries(skillTranslations)
                .map(([eng, chi]) => `
                    <label>
                        <input type="checkbox" value="${eng}"> ${chi}
                    </label>
                `).join('')}
        `;

        // 添加事件監聽
        filterDiv.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                filterPetsBySkills();
            }
        });

        document.body.appendChild(filterDiv);
        // 初始化時執行一次過濾
        filterPetsBySkills();
    }

    function filterPetsBySkills() {
        const selectedSkills = Array.from(document.querySelectorAll('.skill-filter input:checked'))
            .map(checkbox => checkbox.value);

        const petRows = document.querySelectorAll('tr[class*="_14ahg4p9"]');
        
        petRows.forEach(row => {
            const skillsInfo = row.querySelector('.pet-skills-info');
            if (!skillsInfo) {
                row.style.display = 'none';
                return;
            }

            const petSkills = skillsInfo.textContent
                .replace('技能: ', '')
                .split(', ')
                .map(chi => {
                    const entry = Object.entries(skillTranslations)
                        .find(([_, value]) => value === chi);
                    return entry ? entry[0] : chi;
                });

            // 修改邏輯：必須完全符合所有勾選的技能才顯示
            const hasAllSelectedSkills = selectedSkills.length === 0 || 
                selectedSkills.every(skill => petSkills.includes(skill));
            
            row.style.display = hasAllSelectedSkills ? '' : 'none';
        });
    }
})();