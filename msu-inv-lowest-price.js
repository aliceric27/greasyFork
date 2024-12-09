// ==UserScript==
// @name         MSU 包包小精靈
// @namespace    http://tampermonkey.net/
// @version      0.61
// @author       Alex from MyGOTW
// @description  擷取 MSU.io 物品價格與庫存
// @match        https://msu.io/marketplace/inventory/*
// @grant        none
// @run-at       document-end
// @license MIT
// ==/UserScript==

(function() {
    'use strict';
    // 修改初始化函式
    function initialize() {
            window.addEventListener('load',()=>{
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.addedNodes.length) {
                            getNFTitem();
                        }
                    });
                });

                // 監聽目標節點
                const targetNode = document.querySelector('div[class*="item-list"]');
                if (targetNode) {
                    observer.observe(targetNode, {
                        childList: true,
                        subtree: true
                    });
                }

                // 初始執行一次
                getNFTitem();
            });
    }

    const getNFTitem = () => {
        addStyleToHead();
        const articles = document.querySelectorAll('div[class*="item-list"] > article');
        let currentActiveBtn = null;
        let isClickable = true;
        let allButtons = []; // 新增儲存所有按鈕的陣列

        articles.forEach(article => {
            if (article.querySelector('.click-btn')) return;

            const nameSpanElement = article.querySelector('.leave-box div div span:first-child');
            if (nameSpanElement && nameSpanElement.innerText) {
                const fragment = document.createDocumentFragment();

                let textDiv = document.createElement('div');
                textDiv.textContent = '查看市場價格';
                textDiv.className = 'click-btn';
                allButtons.push(textDiv); // 將按鈕加入陣列

                textDiv.onclick = async () => {
                    if (!isClickable) return;

                    isClickable = false;
                    // 設定所有按鈕為禁用狀態
                    allButtons.forEach(btn => {
                        btn.style.cursor = 'not-allowed';
                    });

                    const originalText = textDiv.textContent;
                    textDiv.textContent = '';
                    textDiv.classList.add('loading');

                    const itemName = filterNFTitem(nameSpanElement.innerText);
                    const result = await fetchItme(itemName);
                    textDiv.classList.remove('loading');
                    textDiv.textContent = result;

                    setTimeout(() => {
                        isClickable = true;
                        // 恢復所有按鈕的狀態
                        allButtons.forEach(btn => {
                            btn.style.cursor = 'pointer';
                        });
                        textDiv.textContent = originalText;
                    }, 3000);
                }

                fragment.appendChild(textDiv);
                article.insertBefore(fragment.firstChild, article.firstChild);

                article.addEventListener('mouseenter', () => {
                    if (currentActiveBtn && currentActiveBtn !== textDiv) {
                        currentActiveBtn.style.display = 'none';
                    }
                    textDiv.style.display = 'block';
                    currentActiveBtn = textDiv;
                });
            }
        });
    }

    const filterNFTitem = (name) =>{
        const match = name.match(/^(.*?)(?=#|$)/);
        if (match) {
            return match[1].trim(); // 保留中間的空格，但去除前後空格
        }
        return name;
    }
    const addStyleToHead = () => {
        const style = document.createElement('style');
        const css = `
            .click-btn {
                width: 100%;
                background-color: rebeccapurple;
                border-radius: 5px;
                cursor: pointer;
                color: white;
                padding: 5px;
                text-align: center;
                margin-top: 5px;
                transition: background-color 0.3s, cursor 0.3s;
                display: none;
                z-index: 9999;
            }
            .click-btn:hover {
                background-color: #663399;
            }

            /* 新增載入動畫相關樣式 */
            .loading {
                position: relative;
                min-height: 24px;
            }
            .loading::after {
                content: '';
                position: absolute;
                width: 20px;
                height: 20px;
                top: 50%;
                left: 50%;
                margin-top: -10px;
                margin-left: -10px;
                border: 2px solid #ffffff;
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        style.textContent = css;
        document.head.appendChild(style);
    }

    const getLowestPriceItem = (priceData, exactName) => {
        console.log(exactName)
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

    const fetchItme = async(itemName) => {
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
                    filter: { name:itemName },
                    sorting: "ExploreSorting_LOWEST_PRICE",
                    paginationParam: { pageNo: 1, pageSize: 135 }
                }),
                method: "POST",
                mode: "cors",
                credentials: "include"
            });

            const priceData = await searchResult.json();
            const lowestPriceItem = getLowestPriceItem(priceData, itemName);
            const fullPrice = lowestPriceItem ?
                (BigInt(lowestPriceItem.salesInfo.priceWei) / BigInt(1e18))
                .toString() + '.' +
                (BigInt(lowestPriceItem.salesInfo.priceWei) % BigInt(1e18))
                .toString()
                .padStart(18, '0')
                .slice(0, 6) :
                null;
            return fullPrice ? `${fullPrice} Neso` : '無上架資料'
        } catch (error) {
            console.error(`查詢 ${itemName} 價格時發生錯誤:`, error);
        }
    }


    // 執行初始化
    initialize();
})();

