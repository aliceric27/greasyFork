// ==UserScript==
// @name         MSU 包包小精靈
// @namespace    http://tampermonkey.net/
// @version      0.51
// @author       Alex from MyGOTW
// @description  擷取 MSU.io 物品價格與庫存
// @match        https://msu.io/marketplace/inventory/*
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==

(function() {
    'use strict';
    
    // 儲存所有物品資料的陣列
    let allItemsData = [];
    // 儲存擷取到的物品資訊
    let capturedItems = [];
    
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
        sidebar.style.backgroundColor = 'rgba(250, 228, 254, 0.56)';
        sidebar.style.color = '#000000';
        sidebar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        sidebar.style.transition = 'left 0.3s ease';
        sidebar.style.overflowY = 'auto';
        sidebar.style.zIndex = '1000';
        sidebar.style.padding = '15px';
        sidebar.style.borderRadius = '0 5px 5px 0';
        sidebar.style.border = '1px solid rgba(0,0,0,0.1)';
        sidebar.style.backdropFilter = 'blur(25px)';

        sidebar.style.scrollbarWidth = 'thin';
        sidebar.style.scrollbarColor = 'rgb(38 38 38 / 19%)  rgb(38 38 38 / 0%)';

        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            .custom-sidebar::-webkit-scrollbar {
                width: 8px;
            }
            .custom-sidebar::-webkit-scrollbar-track {
                background: 'rgba(255, 255, 255, 0)';
                border-radius: 0 12px 12px 0;
            }
            .custom-sidebar::-webkit-scrollbar-thumb {
                background-color: #cccccc;
                border-radius: 0 12px 12px 0;
                border: 2px solid transparent;
                background-clip: padding-box;
            }
            .custom-sidebar::-webkit-scrollbar-thumb:hover {
                background-color: #999999;
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
            name.style.color = '#000000';
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
            price.style.color = '#000000';
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
        totalValueSpan.style.color = '#000000';
        totalValueSpan.style.borderTop = '1px solid #404040';
        totalValueSpan.appendChild(nesoImg);
        totalValueSpan.appendChild(document.createTextNode(`這頁背包總價值: ${totalValue.toFixed(6)}`));
        sidebar.appendChild(totalValueSpan);
    }

    // 修改按鈕樣式和位置
    function createStartButton() {
        // 新增 CSS 樣式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            
            .loading-button {
                position: relative;
                color: transparent !important;
            }
            
            .loading-button::after {
                content: '';
                position: absolute;
                width: 16px;
                height: 16px;
                top: 50%;
                left: 50%;
                margin-left: -8px;
                margin-top: -8px;
                border: 2px solid #ffffff;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 1s linear infinite;
            }
        `;
        document.head.appendChild(style);

        const button = document.createElement('button');
        button.textContent = '啟動價格查詢';
        button.style.position = 'fixed';
        button.style.left = '20px';
        button.style.bottom = '20px';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#4CAF50';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';
        button.style.minWidth = '120px';  // 確保按鈕寬度固定
        button.style.minHeight = '40px';   // 確保按鈕高度固定

        button.addEventListener('mouseover', () => {
            if (!button.classList.contains('loading-button')) {
                button.style.backgroundColor = '#45a049';
            }
        });

        button.addEventListener('mouseout', () => {
            if (!button.classList.contains('loading-button')) {
                button.style.backgroundColor = '#4CAF50';
            }
        });

        button.addEventListener('click', async () => {
            if (button.classList.contains('loading-button')) {
                return; // 如果正在載入中，不執行任何操作
            }
            
            // 添加載入動畫
            button.classList.add('loading-button');
            button.disabled = true;
            
            try {
                await processItemsData(capturedItems);
            } finally {
                // 完成後移除載入動畫
                button.classList.remove('loading-button');
                button.disabled = false;
                button.textContent = '更新價格';
                button.style.backgroundColor = '#2196F3';
            }
        });

        document.body.appendChild(button);
        return button;
    }

    // 新增：監聽並擷取物品資訊的函式
    function initializeDataCapture() {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const [url, options] = args;
            const response = await originalFetch(...args);
            
            if (url.includes('/marketplace/api/marketplace/inventory/') && 
                url.includes('/owned')) {
                try {
                    const clone = response.clone();
                    const data = await clone.json();
                    if(data?.records) {
                        capturedItems = data.records;
                        console.log('已擷取物品資料:', capturedItems);
                    }
                } catch (error) {
                    console.error('擷取物品資料時發生錯誤:', error);
                }
            }
            return response;
        };
    }

    // 新增：處理已擷取物品資料的函式
    async function processItemsData(items) {
        if (!items || items.length === 0) {
            console.log('沒有可處理的物品資料');
            return;
        }

        // 清空之前的資料
        allItemsData = [];
        // 建立一個 Set 來追蹤已查詢過的物品名稱
        const processedNames = new Set();
        
        for (const item of items) {
            const {name} = item;
            
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
                
                const fullPrice = lowestPriceItem ? 
                    (BigInt(lowestPriceItem.salesInfo.priceWei) / BigInt(1e18))
                    .toString() + '.' + 
                    (BigInt(lowestPriceItem.salesInfo.priceWei) % BigInt(1e18))
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
        
        // 創建並填充側邊欄
        const sidebar = createSidebar();
        populateSidebar(sidebar, allItemsData);
    }

    // 修改初始化函式
    function initialize() {
        // 先啟動資料擷取
        initializeDataCapture();
        
        // 確保頁面已完全載入後再創建按鈕
        if (document.readyState === 'complete') {
            createStartButton();
        } else {
            window.addEventListener('load', createStartButton);
        }
    }

    // 執行初始化
    initialize();
})();

