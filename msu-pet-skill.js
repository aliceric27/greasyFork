// ==UserScript==
// @name         MSU 寵物技能快快出
// @namespace    http://tampermonkey.net/
// @version      0.82
// @author       Alex from MyGOTW
// @description  擷取 MSU.io 寵物技能
// @match        https://msu.io/marketplace/nft?sort=ExploreSorting_*&price=0%2C10000000000&level=0%2C250&categories=1000400000%2C1000401001&potential=0%2C4&bonusPotential=0%2C4&starforce=0%2C25&viewMode=0*
// @match        https://msu.io/marketplace/nft?price=0%2C10000000000&level=0%2C250&categories=1000400000%2C1000401001&potential=0%2C4&bonusPotential=0%2C4&starforce=0%2C25&viewMode=0*
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==
/*

0.73 將資料保存 localStorage 中，並且過期時間為 24 小時
0.75 稍微修改技能說明
0.8 新增icon
0.81 優化技能顯示
*/

(function() {
    'use strict';

    // 追蹤已處理過的 tokenID
    const processedTokens = new Set();
    // Pet skill img
    const petImg = {
        'Item Pouch': 'https://cdn.wikimg.net/en/strategywiki/images/8/87/MS_Pet_Item_only.png',
        'NESO Magnet': 'https://msu.io/marketplace/images/neso.png',
        'Auto HP Potion Pouch': 'https://cdn.wikimg.net/en/strategywiki/images/2/22/MS_Pet_Autopot.png',
        'Auto MP Potion Pouch': 'https://cdn.wikimg.net/en/strategywiki/images/f/f9/MS_Pet_MP_Recharge.png',
        'Auto Move': 'https://cdn.wikimg.net/en/strategywiki/images/2/27/MS_Pet_Autoloot.png',
        'Expanded Auto Move': 'https://cdn.wikimg.net/en/strategywiki/images/2/2a/MS_Pet_Range.png',
        'Fatten Up': 'https://github.com/aliceric27/picx-images-hosting/raw/master/hexo-blog/image.8vmyjueg5g.webp',
        'Auto Buff': 'https://github.com/aliceric27/picx-images-hosting/raw/master/hexo-blog/image.1hs9b2tx0k.webp',
        'Pet Training Skill': 'https://cdn.wikimg.net/en/strategywiki/images/3/34/MS_Pet_Unlootable_Item.png',
        'Magnet Effect': '🧲'
    }
    // 定義要篩選的技能
    const skillTranslations = {
        'Item Pouch': `撿取道具`,
        'NESO Magnet': `撿取NESO`,
        'Auto HP Potion Pouch': `自動HP藥水`,
        'Auto MP Potion Pouch': `自動MP藥水`,
        'Auto Move': `自動移動`,
        'Expanded Auto Move': `擴大自動移動範圍`,
        'Fatten Up': `寵物巨大化`,
        'Auto Buff': `自動上Buff`,
        'Pet Training Skill': `親密度提升`,
        'Magnet Effect': `磁力效果(P寵)`
    };

    function getskillImg(skill) {
        if (skill === 'Magnet Effect') {
            return '🧲';
        }
        return `<img src="${petImg[skill]}" alt="${skill}" width="24">` || skill;
    }

    // 新增翻譯函數
    function translateSkill(skill) {
        return skillTranslations[skill] || skill;
    }

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const [resource, config] = args;

        // 檢查是否是目標 API 請求
        if (resource.includes('/marketplace/api/marketplace/explore/items')) {
            console.log('監聽到 API 請求:', {
                url: resource,
                body: config ? JSON.parse(config.body) : null
            });

            try {
                const response = await originalFetch(resource, config);
                const clone = response.clone();

                clone.json().then(async data => {
                    console.log('物品資料:', data);
                    if (data.items) {
                        let AllToken = [];
                        let allData = [];
                        const storedData = getFromStorage() || {};

                        // 先處理已存儲的資料
                        for (const item of data.items) {
                            const tokenId = item.tokenId;
                            if (storedData[tokenId]) {
                                const storedItem = storedData[tokenId];
                                if (storedItem.item && storedItem.item.pet) {
                                    const petSkills = storedItem.item.pet.petSkills || [];
                                    const mintingNo = storedItem.tokenInfo?.mintingNo;
                                    const fullPetName = `${storedItem.item.name} #${mintingNo}`;
                                    await tryFindAndInsertSkills(fullPetName, petSkills);
                                }
                                processedTokens.add(tokenId);
                            }
                        }

                        // 篩選出未處理過且未存儲的 tokenID
                        AllToken = data.items
                            .map(item => item.tokenId)
                            .filter(tokenId => !processedTokens.has(tokenId) && !storedData[tokenId]);

                        console.log('未處理的 Token:', AllToken);

                        // 對每個未處理的 tokenID 發送 API 請求
                        for (const tokenId of AllToken) {
                            try {
                                console.log('開始抓資料啦')
                                await delay(50);
                                const response = await originalFetch(`https://msu.io/marketplace/api/marketplace/items/${tokenId}`);
                                const itemData = await response.json();
                                allData.push(itemData);
                                storedData[tokenId] = itemData;

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

                        // 儲存更新後的資料
                        saveToStorage(storedData);

                        console.log('allData', allData);

                        // 在所有資料處理完後，創建或更新過濾面板
                        await delay(500); // 等待DOM更新
                        if (!document.querySelector('.skill-filter')) {
                            createFilterPanel();
                        }

                        // 更新頁面上的技能資訊
                        updateSkillsOnPage();
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
            // 使用更穩定的選擇器：找到所有包含寵物名稱的 span
            const allNameElements = Array.from(document.getElementsByTagName('span'))
                .filter(span => span.textContent.includes('#')); // 寵物名稱通常包含 #
            let found = false;
    
            for (const element of allNameElements) {
                if (element.textContent.includes(fullPetName)) {
                    // 往上找到包含寵物資訊的 tr
                    const row = element.closest('tr');
                    if (row) {
                        // 在 tr 中找到第二個 td（通常是包含寵物資訊的單元格）
                        const infoCell = row.children[1];
                        // 在 td 中找到包含寵物名稱的 div 的下一個 div
                        const targetDiv = infoCell.querySelector('div > div:nth-child(2)');
                        const existingSkills = targetDiv?.querySelector('.pet-skills-info');
    
                        if (!existingSkills && targetDiv) {
                            const skillsContainer = document.createElement('div');
                            skillsContainer.className = 'pet-skills-info';
                            skillsContainer.style.cssText = `
                                border-radius: 5px;
                                padding: 5px;
                                margin-top: 5px;
                                z-index: 1;
                            `;

                            const { basic, special } = categorizeSkills(petSkills);
                            
                            // 基礎技能行
                            const basicRow = document.createElement('div');
                            basicRow.style.marginBottom = special.length ? '4px' : '0';
                            basic.forEach(skill => basicRow.appendChild(createSkillElement(skill)));
                            skillsContainer.appendChild(basicRow);
                            
                            // 特殊技能行
                            if (special.length > 0) {
                                const specialRow = document.createElement('div');
                                special.forEach(skill => specialRow.appendChild(createSkillElement(skill, true)));
                                skillsContainer.appendChild(specialRow);
                            }

                            targetDiv.appendChild(skillsContainer);
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

    function categorizeSkills(petSkills) {
        const basicSkills = [
            'Item Pouch',
            'NESO Magnet',
            'Auto HP Potion Pouch',
            'Auto MP Potion Pouch'
        ];
        
        return {
            basic: petSkills.filter(skill => basicSkills.includes(skill)),
            special: petSkills.filter(skill => !basicSkills.includes(skill))
        };
    }

    function createSkillElement(skill, isSpecial = false) {
        const skillDiv = document.createElement('div');
        skillDiv.style.cssText = `
            display: inline-block;
            margin: 2px 4px;
            padding: 2px 6px;
            border-radius: 4px;
            background-color: black;
            color: ${isSpecial ? '#ffd700' : '#ffffff'};
            font-size: 11px;
        `;
        skillDiv.innerHTML = `${translateSkill(skill)}`;
        return skillDiv;
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
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" value="${eng}"/> <span style="display: inline-flex; align-items: center;">${getskillImg(eng)} ${chi}</span>
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
    
        const petRows = document.querySelectorAll('tr');
    
        petRows.forEach(row => {
            const skillsInfo = row.querySelector('.pet-skills-info');
            if (!skillsInfo) {
                row.style.display = 'none';
                return;
            }
    
            // 獲取所有技能 div 的文字內容
            const petSkills = Array.from(skillsInfo.querySelectorAll('div > div'))
                .map(skillDiv => {
                    // 從中文技能名稱反查英文名稱
                    const chineseSkill = skillDiv.textContent.trim();
                    const entry = Object.entries(skillTranslations)
                        .find(([_, value]) => value === chineseSkill);
                    return entry ? entry[0] : chineseSkill;
                });
    
            // 修改邏輯：必須完全符合所有勾選的技能才顯示
            const hasAllSelectedSkills = selectedSkills.length === 0 ||
                selectedSkills.every(skill => petSkills.includes(skill));
    
            row.style.display = hasAllSelectedSkills ? '' : 'none';
        });
    }

    // 在 skillTranslations 後面加入新的常數
    const STORAGE_KEY = 'msu_pet_data';
    const DATA_EXPIRE_TIME = 24 * 60 * 60 * 1000; // 24小時的毫秒數

    // 新增用於處理 localStorage 的函數
    function saveToStorage(data) {
        const storageData = {
            timestamp: Date.now(),
            items: data
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
    }

    function getFromStorage() {
        const storageData = localStorage.getItem(STORAGE_KEY);
        if (!storageData) return null;

        const { timestamp, items } = JSON.parse(storageData);
        // 檢查資料是否過期
        if (Date.now() - timestamp > DATA_EXPIRE_TIME) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
        return items;
    }

    // 新增更新頁面技能資訊的函數
    function updateSkillsOnPage() {
        const storedData = getFromStorage() || {};
        for (const tokenId in storedData) {
            const itemData = storedData[tokenId];
            if (itemData.item && itemData.item.pet) {
                const petSkills = itemData.item.pet.petSkills || [];
                const mintingNo = itemData.tokenInfo?.mintingNo;
                const fullPetName = `${itemData.item.name} #${mintingNo}`;
                tryFindAndInsertSkills(fullPetName, petSkills);
            }
        }
    }
})();