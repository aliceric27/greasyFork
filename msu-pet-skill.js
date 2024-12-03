// ==UserScript==
// @name         MSU 寵物技能快快出
// @namespace    http://tampermonkey.net/
// @version      0.7
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
 
        // 修改條件，移除 hasExecuted 檢查
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
                                
                                // 將處理過的 tokenID 加入 Set
                                processedTokens.add(tokenId);
                            } catch (error) {
                                console.error(`無法獲取 tokenID ${tokenId} 的資料:`, error);
                            }
                        }
                        console.log('allData', allData);
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
})();