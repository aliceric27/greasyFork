// ==UserScript==
// @name         MSU 包包小精靈
// @namespace    http://tampermonkey.net/
// @version      0.1
// @author       Alex from MyGOTW
// @description  擷取 MSU.io 物品價格與庫存
// @match        https://msu.io/marketplace/inventory/*
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==

(function() {
    'use strict';
    
    const originalFetch = window.fetch;
    // 儲存所有物品資料的陣列
    let allItemsData = [];

    // 取得最低價格物件的函式
    function getLowestPriceItem(priceData, exactName) {
        if (!priceData?.items || priceData.items.length === 0) {
            return null;
        }

        // 只篩選完全符合名稱的物品
        const exactMatches = priceData.items.filter(item => item.name === exactName);
        
        if (exactMatches.length === 0) {
            return null;
        }

        return exactMatches.reduce((lowest, current) => {
            const currentPrice = BigInt(current.salesInfo?.priceWei || '0');
            const lowestPrice = BigInt(lowest.salesInfo?.priceWei || '0');
            
            return currentPrice < lowestPrice ? current : lowest;
        }, exactMatches[0]);
    }
    
    function createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.style.position = 'fixed';
        sidebar.style.left = '-180px';
        sidebar.style.top = '50%';
        sidebar.style.transform = 'translateY(-50%)';
        sidebar.style.width = '200px';
        sidebar.style.height = '80vh';
        sidebar.style.backgroundColor = '#252525';
        sidebar.style.color = '#ffffff';
        sidebar.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
        sidebar.style.transition = 'left 0.3s ease';
        sidebar.style.overflowY = 'auto';
        sidebar.style.zIndex = '1000';
        sidebar.style.padding = '15px';
        sidebar.style.borderRadius = '0 8px 8px 0';

        sidebar.style.scrollbarWidth = 'thin';
        sidebar.style.scrollbarColor = '#666 #252525';

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .custom-sidebar::-webkit-scrollbar {
                width: 8px;
            }
            .custom-sidebar::-webkit-scrollbar-track {
                background: #252525;
            }
            .custom-sidebar::-webkit-scrollbar-thumb {
                background-color: #666;
                border-radius: 4px;
            }
        `;
        document.head.appendChild(styleSheet);
        sidebar.classList.add('custom-sidebar');

        sidebar.addEventListener('mouseenter', () => {
            sidebar.style.left = '0';
        });

        sidebar.addEventListener('mouseleave', () => {
            sidebar.style.left = '-180px';
        });

        document.body.appendChild(sidebar);
        return sidebar;
    }

    function populateSidebar(sidebar, itemsData) {
        sidebar.innerHTML = '';
        let totalValue = 0;

        itemsData.forEach(itemData => {
            const itemDiv = document.createElement('div');
            itemDiv.style.padding = '8px';
            itemDiv.style.borderBottom = '1px solid #404040';

            const name = document.createElement('h4');
            name.style.margin = '0 0 5px 0';
            name.style.fontSize = '14px';
            name.style.color = '#ffffff';
            name.textContent = itemData.ownedItem.name;
            itemDiv.appendChild(name);

            const img = document.createElement('img');
            img.src = itemData.ownedItem.imageUrl || 'default-image-url.jpg';
            img.style.width = '24px';
            img.style.height = '24px';
            itemDiv.appendChild(img);

            const price = document.createElement('p');
            price.style.margin = '5px 0 0 0';
            price.style.fontSize = '12px';
            price.style.color = '#ffffff';
            const itemPrice = parseFloat(itemData.lowestPrice) || 0;
            price.textContent = `最低價格: ${itemPrice ? itemPrice : '無上架資料'}`;
            itemDiv.appendChild(price);
            if(itemPrice){
                totalValue += itemPrice;
            }
            sidebar.appendChild(itemDiv);
        });

        const nesoImg = document.createElement('img');
        nesoImg.src = 'https://msu.io/marketplace/images/neso.png';
        nesoImg.style.width = '16px';
        nesoImg.style.height = '16px';
        nesoImg.style.marginRight = '5px';
        nesoImg.style.verticalAlign = 'middle';

        const totalValueSpan = document.createElement('span');
        totalValueSpan.style.display = 'block';
        totalValueSpan.style.padding = '10px';
        totalValueSpan.style.fontSize = '14px';
        totalValueSpan.style.color = '#ffffff';
        totalValueSpan.style.borderTop = '1px solid #404040';
        totalValueSpan.appendChild(nesoImg);
        totalValueSpan.appendChild(document.createTextNode(`背包總價值: ${totalValue.toFixed(6)}`));
        sidebar.appendChild(totalValueSpan);
    }

    window.fetch = async function(...args) {
        const [url, options] = args;
        
        if (url.includes('/marketplace/api/marketplace/inventory/') && 
            url.includes('/owned')) {
            try {
                const response = await originalFetch(...args);
                const clone = response.clone();
                const data = await clone.json();
                
                if(data?.records){
                    // 清空之前的資料
                    allItemsData = [];
                    // 建立一個 Set 來追蹤已查詢過的物品名稱
                    const processedNames = new Set();
                    
                    for (const item of data.records) {
                        const {tokenId, name} = item;
                        
                        // 檢查是否已經查詢過該物品
                        if (processedNames.has(name)) {
                            console.log(`${name} 已經查詢過，跳過重複請求`);
                            continue;
                        }
                        
                        // 將物品名稱加入已處理集合
                        processedNames.add(name);
                        
                        try {
                            const searchResult = await fetch("https://msu.io/marketplace/api/marketplace/explore/items", {
                                headers: {
                                    "accept": "*/*",
                                    "cache-control": "no-cache",
                                    "content-type": "application/json",
                                    "sec-fetch-dest": "empty",
                                    "sec-fetch-mode": "cors",
                                    "sec-fetch-site": "same-origin"
                                },
                                body: JSON.stringify({
                                    filter: { name },
                                    sorting: "ExploreSorting_LOWEST_PRICE",
                                    paginationParam: { pageNo: 1, pageSize: 135 }
                                }),
                                method: "POST",
                                mode: "cors",
                                credentials: "include"
                            });
                            
                            const priceData = await searchResult.json();
                            const lowestPriceItem = getLowestPriceItem(priceData, name);
                            
                            // 將原始物品資料和最低價格資訊組合
                            const fullPrice = lowestPriceItem ? 
                                (BigInt(lowestPriceItem.salesInfo.priceWei) * BigInt(1e18) / BigInt(1e36)).toString() + '.' + 
                                (BigInt(lowestPriceItem.salesInfo.priceWei) * BigInt(1e18) % BigInt(1e36))
                                    .toString()
                                    .padStart(18, '0')
                                    .slice(0, 6) : 
                                null;

                            allItemsData.push({
                                ownedItem: item,
                                marketInfo: lowestPriceItem,
                                lowestPrice: fullPrice
                            });
                            
                            console.log(`${name} 的最低價格:`, 
                                lowestPriceItem ? 
                                fullPrice + 'Neso' : 
                                '無上架資料');
                            
                        } catch (error) {
                            console.error(`查詢 ${name} 價格時發生錯誤:`, error);
                        }
                    }
                    
                    console.log('所有物件資料:', allItemsData);

                    // 創建並填充側邊欄
                    const sidebar = createSidebar();
                    populateSidebar(sidebar, allItemsData);
                }
                return response;
            } catch (error) {
                console.error('MSU 庫存資料擷取錯誤:', error);
                throw error;
            }
        }  
        return originalFetch(...args);
    };
})();

