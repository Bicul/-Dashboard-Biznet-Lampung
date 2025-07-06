// script.js
// URL Google Apps Script Anda yang akan mengembalikan data pelanggan dalam format JSON.
// PASTIKAN URL INI BENAR dan Apps Script Anda di-deploy dengan akses "Anyone".
// GANTI DENGAN URL APPS SCRIPT ANDA YANG BARU SETELAH DEPLOYMENT ULANG
const DATA_URL = 'https://script.google.com/macros/s/AKfycbzkV_Z8qbvCw--RYaOTDBYia9DKob0Du5J9c47JCKr3zmr8_6AI0QPle6UgituFTs3hJA/exec'; // URL telah diperbarui dengan yang Anda berikan.

// Global variables to store all customer data and filtered data
let allCustomerData = [];
let filteredCustomerData = []; // Data for the main dashboard (filtered by product type)
let currentBranchData = []; // Data for the currently selected branch
let currentBranchName = ''; // Stores the name of the currently selected branch

// Chart.js instances for main dashboard charts
let top5NewDemandChart;
let mtdRegistrationStatusChart;

// Chart.js instances for branch detail view charts
let branchBundleNameChart;
let branchModemStatusChart; // New chart instance for Modem Status Analysis
let branchNetSubscribersChart; // New chart instance for Net Subscribers Analysis
let branchDailyNewSubscribersChart; // New chart instance for Daily New Subscribers
let branchDailyTerminationChart; // New chart instance for Daily Termination Subscribers

// Global variable to store the latest available date in the data
let latestAvailableDataDate = null;

// Global variable to track the currently selected product filter ('all', 'home', 'metronet', 'enterprise')
let currentProductFilter = 'all';

// Pagination variables for branch customer list
let branchCustomerCurrentPage = 1;
const branchCustomerRowsPerPage = 10;
let filteredBranchCustomerData = []; // Data for the branch customer list table after search/filters

// Event listener that will run after the DOM (HTML) is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Register the datalabels plugin globally
    Chart.register(ChartDataLabels);

    // Start the data fetching process when the page loads
    fetchData();

    // Add event listeners for product filter buttons (main dashboard)
    document.getElementById('filterAllProducts')?.addEventListener('click', () => setProductFilter('all'));
    document.getElementById('filterHome')?.addEventListener('click', () => setProductFilter('home'));
    document.getElementById('filterMetronet')?.addEventListener('click', () => setProductFilter('metronet'));
    document.getElementById('filterEnterprise')?.addEventListener('click', () => setProductFilter('enterprise'));

    // Toggle for branch list in sidebar
    const branchListToggle = document.getElementById('branchListToggle');
    const branchList = document.getElementById('branchList');
    const branchToggleIcon = document.getElementById('branchToggleIcon');

    if (branchListToggle && branchList && branchToggleIcon) {
        branchListToggle.addEventListener('click', (e) => {
            e.preventDefault();
            if (branchList.classList.contains('hidden')) {
                branchList.classList.remove('hidden');
                branchToggleIcon.classList.remove('fa-chevron-down');
                branchToggleIcon.classList.add('fa-chevron-up');
            } else {
                branchList.classList.add('hidden');
                branchToggleIcon.classList.remove('fa-chevron-up');
                branchToggleIcon.classList.add('fa-chevron-down');
            }
        });
    }

    // Event listener for "Back to Dashboard" button
    document.getElementById('backToDashboardBtn')?.addEventListener('click', showMainDashboard);

    // Event listeners for sub-navigation buttons in branch detail view
    document.getElementById('showCustomerListBtn')?.addEventListener('click', () => showBranchDetailSection('customerList'));
    document.getElementById('showSalesCodeStatusBtn')?.addEventListener('click', () => showBranchDetailSection('salesCodeStatus'));
    document.getElementById('showBundleNameAnalysisBtn')?.addEventListener('click', () => showBranchDetailSection('bundleNameAnalysis'));
    // New event listeners for new sections
    document.getElementById('showModemStatusAnalysisBtn')?.addEventListener('click', () => showBranchDetailSection('modemStatusAnalysis'));
    document.getElementById('showNetSubscribersAnalysisBtn')?.addEventListener('click', () => showBranchDetailSection('netSubscribersAnalysis'));
    document.getElementById('showDailyNewSubscribersBtn')?.addEventListener('click', () => showBranchDetailSection('dailyNewSubscribers'));
    document.getElementById('showDailyTerminationSubscribersBtn')?.addEventListener('click', () => showBranchDetailSection('dailyTerminationSubscribers'));


    // Event listeners for customer list filters in branch detail view
    document.getElementById('customerSearchInput')?.addEventListener('input', applyBranchCustomerFilters); // Use 'input' for real-time search
    document.getElementById('customerStatusFilter')?.addEventListener('change', applyBranchCustomerFilters);
    document.getElementById('customerSalesCodeFilter')?.addEventListener('change', applyBranchCustomerFilters);
    document.getElementById('applyCustomerFilters')?.addEventListener('click', applyBranchCustomerFilters);
    document.getElementById('resetCustomerFilters')?.addEventListener('click', resetBranchCustomerFilters);


    // Pagination for branch customer list
    document.getElementById('branchPrevPage')?.addEventListener('click', () => changeBranchCustomerPage(-1));
    document.getElementById('branchNextPage')?.addEventListener('click', () => changeBranchCustomerPage(1));

    // Event listeners for Bundle Name Analysis filters
    document.getElementById('bundleNameYearFilter')?.addEventListener('change', () => renderBranchBundleNameChart(currentBranchData));
    document.getElementById('bundleNameMonthFilter')?.addEventListener('change', () => renderBranchBundleNameChart(currentBranchData));

    // New event listeners for Modem Status Analysis filters
    document.getElementById('modemStatusYearFilter')?.addEventListener('change', () => renderBranchModemStatusChart(currentBranchData));
    document.getElementById('modemStatusMonthFilter')?.addEventListener('change', () => renderBranchModemStatusChart(currentBranchData));

    // New event listeners for Net Subscribers Analysis filters
    document.getElementById('netSubscribersYearFilter')?.addEventListener('change', () => renderBranchNetSubscribersChart(currentBranchData));
    document.getElementById('netSubscribersMonthFilter')?.addEventListener('change', () => renderBranchNetSubscribersChart(currentBranchData));

    // New event listeners for Daily New Subscribers filters
    document.getElementById('dailyNewYearFilter')?.addEventListener('change', () => renderBranchDailyNewSubscribersChart(currentBranchData));
    document.getElementById('dailyNewMonthFilter')?.addEventListener('change', () => renderBranchDailyNewSubscribersChart(currentBranchData));

    // New event listeners for Daily Termination Subscribers filters
    document.getElementById('dailyTerminationYearFilter')?.addEventListener('change', () => renderBranchDailyTerminationChart(currentBranchData));
    document.getElementById('dailyTerminationMonthFilter')?.addEventListener('click', () => renderBranchDailyTerminationChart(currentBranchData)); // Changed to click for consistency

    // Event listener for Dashboard Nav Link
    document.getElementById('dashboardNavLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showMainDashboard();
        // Update active state in sidebar
        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById('dashboardNavLink').classList.add('active');
        const allBranchesItem = document.getElementById('branchList').querySelector('[data-branch-name="All Branches"]');
        if (allBranchesItem) {
            document.querySelectorAll('#branchList .list-group-item').forEach(item => item.classList.remove('active'));
            allBranchesItem.classList.add('active');
        }
    });

    // Event listener for clicking the main dashboard Termination Subscribers KPI
    document.getElementById('terminationSubscribersKpi')?.addEventListener('click', () => {
        displayInlineTerminatedCustomers('All Branches');
    });
    document.getElementById('closeInlineTerminatedCustomersBtn')?.addEventListener('click', hideInlineTerminatedCustomers);
});

/**
 * Helper function to parse date strings into Date objects.
 * Handles various date formats and returns null for invalid dates.
 * Specifically handles DD/MM/YYYY and Excel date serials.
 * @param {string|number} dateValue - The date string or Excel serial number to parse.
 * @returns {Date|null} A Date object if parsing is successful, otherwise null.
 */
function parseDateString(dateValue) {
    if (dateValue === null || dateValue === undefined || dateValue === '') return null;

    // Try parsing as a number (Excel date serial)
    if (typeof dateValue === 'number') {
        // Excel date serial number (days since 1899-12-30).
        // Adjust for JavaScript Date object (milliseconds since 1970-01-01).
        // 25569 is the number of days between 1899-12-30 and 1970-01-01.
        // 86400000 is milliseconds in a day.
        const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
        const date = new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
        if (!isNaN(date.getTime())) {
            date.setHours(0, 0, 0, 0); // Normalize to start of day
            return date;
        }
    }

    const dateString = String(dateValue);

    // Try parsing DD/MM/YYYY format (common in Indonesia)
    const dmyParts = dateString.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (dmyParts) {
        const day = parseInt(dmyParts[1]);
        const month = parseInt(dmyParts[2]);
        let year = parseInt(dmyParts[3]);

        // Handle 2-digit year (e.g., 23 -> 2023, 98 -> 1998)
        if (year < 100) year += (year > 50 ? 1900 : 2000);

        const date = new Date(year, month - 1, day); // Month is 0-indexed in JS Date
        // Validate if the parsed date components match the original (e.g., 31/02/2023 should be invalid)
        if (date.getFullYear() === year && (date.getMonth() + 1) === month && date.getDate() === day) {
            date.setHours(0, 0, 0, 0); // Normalize to start of day
            return date;
        }
    }

    // Fallback: Try parsing as a standard date string (e.g., ISO-MM-DD, MM/DD/YYYY)
    let date = new Date(dateString);
    if (!isNaN(date.getTime())) {
        date.setHours(0, 0, 0, 0); // Normalize to start of day
        return date;
    }

    console.warn(`Failed to parse date: "${dateString}". Returning null.`);
    return null;
}

/**
 * Calculates the duration between two dates in years and months.
 * @param {Date} startDate - The start date.
 * @param {Date} endDate - The end date.
 * @returns {string} A string representing the duration (e.g., "1 tahun 2 bulan", "5 bulan", "Tidak diketahui").
 */
function calculateDuration(startDate, endDate) {
    if (!startDate || !endDate || !(startDate instanceof Date) || !(endDate instanceof Date)) {
        return "Tidak diketahui";
    }

    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) {
        parts.push(`${years} tahun`);
    }
    if (months > 0) {
        parts.push(`${months} bulan`);
    }

    if (parts.length === 0) {
        // If duration is less than a month, calculate in days
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays > 0) {
            return `${diffDays} hari`;
        }
        return "Kurang dari 1 hari";
    }
    return parts.join(' ');
}


/**
 * Shows the main dashboard view and hides the branch detail view.
 */
function showMainDashboard() {
    document.getElementById('mainDashboardView').classList.remove('hidden');
    document.getElementById('branchDetailView').classList.add('hidden');
    hideInlineTerminatedCustomers(); // Hide inline section when returning to main dashboard

    // Update active state in sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
    document.getElementById('dashboardNavLink').classList.add('active');
    const allBranchesItem = document.getElementById('branchList').querySelector('[data-branch-name="All Branches"]');
    if (allBranchesItem) {
        document.querySelectorAll('#branchList .list-group-item').forEach(item => item.classList.remove('active'));
        allBranchesItem.classList.add('active');
    }
    updateDashboard(); // Re-render main dashboard in case filters were changed
}

/**
 * Sets the global product filter and updates the dashboard.
 * @param {string} filterType - 'all', 'home', 'metronet', or 'enterprise'.
 */
function setProductFilter(filterType) {
    currentProductFilter = filterType;
    // Update button active states
    document.querySelectorAll('.header-buttons button').forEach(button => {
        button.classList.remove('active');
    });
    // Ensure the correct button ID is targeted
    let targetButtonId = `filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`;
    if (filterType === 'all') {
        targetButtonId = 'filterAllProducts';
    }
    const activeButton = document.getElementById(targetButtonId);
    if (activeButton) {
        activeButton.classList.add('active');
    }
    
    updateDashboard();
    hideInlineTerminatedCustomers(); // Hide inline section when product filter changes
}

/**
 * Function to fetch data from the Google Apps Script URL.
 * Displays a loading indicator during the data fetching process.
 */
async function fetchData() {
    showLoading(); // Show loading overlay
    try {
        console.log(`Attempting to fetch data from: ${DATA_URL}`);
        const response = await fetch(DATA_URL);
        
        console.log('Raw response from Apps Script:', response);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
            throw new Error(`Gagal mengambil data: Status HTTP ${response.status}. Pesan: ${errorText.substring(0, 100)}...`);
        }
        
        const rawData = await response.json();
        console.log('Parsed raw customer data:', rawData);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            console.warn('Data fetched is empty or not an array. Displaying empty dashboard.');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.innerHTML = '<p class="text-center text-info mt-5">Tidak ada data pelanggan yang tersedia. Mohon periksa sumber data Anda.</p>';
            }
            hideLoading();
            return;
        }

        // Process raw data: parse dates and ensure consistent keys
        allCustomerData = rawData.map(customer => {
            return {
                ...customer,
                // Ensure date fields are parsed
                CONTRACTSTARTDATE: parseDateString(customer.CONTRACTSTARTDATE),
                EXPIREDDATE: parseDateString(customer.EXPIREDDATE),
                TERMDATE: parseDateString(customer.TERMDATE),
                LASTPAYMENTDATE: parseDateString(customer.LASTPAYMENTDATE),
                
                // Ensure STATUS is always uppercase for consistent filtering
                STATUS: customer.STATUS ? String(customer.STATUS).toUpperCase() : null,
                // Ensure BUNDLE_NAME is always uppercase for consistent filtering
                BUNDLE_NAME: customer.BUNDLE_NAME ? String(customer.BUNDLE_NAME).toUpperCase() : null,
                // Ensure SERVICE_TYPE is always uppercase for consistent filtering
                SERVICE_TYPE: customer.SERVICE_TYPE ? String(customer.SERVICE_TYPE).toUpperCase() : null,
                // Ensure MODEM_STATUS is always uppercase for consistent filtering
                MODEM_STATUS: customer.MODEM_STATUS ? String(customer.MODEM_STATUS).toUpperCase() : null,
                // Ensure PROMO_CODE is always uppercase for consistent filtering
                PROMO_CODE: customer.PROMO_CODE ? String(customer.PROMO_CODE).toUpperCase() : null,
                // Ensure SALESCODE is always string for consistency
                SALESCODE: customer.SALESCODE ? String(customer.SALESCODE) : null,
                // Ensure BRANCH_FROM_SALESCODE is always string for consistency
                BRANCH_FROM_SALESCODE: customer.BRANCH_FROM_SALESCODE ? String(customer.BRANCH_FROM_SALESCODE).toUpperCase() : null, // Added .toUpperCase() for consistency
                // Ensure CONTRACTACCOUNT is always string for consistency
                CONTRACTACCOUNT: customer.CONTRACTACCOUNT ? String(customer.CONTRACTACCOUNT) : null,
                // Ensure BP_PHONE is always string for consistency
                BP_PHONE: customer.BP_PHONE ? String(customer.BP_PHONE) : null,
            };
        });
        console.log('Processed allCustomerData:', allCustomerData);

        // Determine the latest available date from relevant date fields
        let tempLatestDate = null;
        allCustomerData.forEach(customer => {
            const dates = [
                customer.CONTRACTSTARTDATE,
                customer.TERMDATE,
                customer.LASTPAYMENTDATE,
                customer.EXPIREDDATE
            ].filter(d => d instanceof Date && d <= new Date()); // Only valid dates up to today

            dates.forEach(date => {
                if (!tempLatestDate || date > tempLatestDate) {
                    tempLatestDate = date;
                }
            });
        });
        latestAvailableDataDate = tempLatestDate;
        console.log('Latest available data date after robust processing:', latestAvailableDataDate ? latestAvailableDataDate.toLocaleDateString('id-ID') : 'N/A');

        // Initial dashboard update with all data
        updateDashboard();
        populateBranchesList();

        const lastUpdateDateElement = document.getElementById('lastUpdateDate');
        const lastUpdateDateHeaderElement = document.getElementById('lastUpdateDateHeader');
        if (lastUpdateDateElement) {
            lastUpdateDateElement.textContent = latestAvailableDataDate ? 
                `Data per: ${latestAvailableDataDate.toLocaleString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}` : 
                'Data tidak tersedia';
        }
        if (lastUpdateDateHeaderElement) {
            lastUpdateDateHeaderElement.textContent = latestAvailableDataDate ? 
                `Data per: ${latestAvailableDataDate.toLocaleString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}` : 
                'Data tidak tersedia';
        }
        // Set initial product filter active state
        setProductFilter(currentProductFilter);

    } catch (error) {
        console.error("Error fetching data:", error);
        let errorMessage = "Gagal memuat data. ";
        if (error.message.includes("Failed to fetch")) {
            errorMessage += "Kemungkinan masalah jaringan atau URL Apps Script tidak dapat dijangkau/CORS. ";
        } else if (error.message.includes("HTTP error!")) {
            errorMessage += error.message;
        } else {
            errorMessage += "Terjadi kesalahan tak terduga.";
        }
        errorMessage += " Mohon periksa konsol browser (F12) untuk detail lebih lanjut dan pastikan Google Apps Script Anda di-deploy dengan akses 'Anyone'.";
        
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.innerHTML = `<p class="text-center text-red-500 mt-5">${errorMessage}</p>`;
        } else {
            alert(errorMessage);
        }
    } finally {
        hideLoading();
    }
}

/**
 * Displays a loading overlay on all dashboard cards.
 */
function showLoading() {
    document.querySelectorAll('.card').forEach(card => {
        if (!card.querySelector('.loading-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = '<div class="spinner"></div>';
            card.appendChild(overlay);
        }
    });
}

/**
 * Hides the loading overlay.
 */
function hideLoading() {
    document.querySelectorAll('.loading-overlay').forEach(overlay => overlay.remove());
}

/**
 * Populates the list of branches in the sidebar.
 */
function populateBranchesList() {
    const branchListDiv = document.getElementById('branchList');
    if (!branchListDiv) {
        console.warn('Branch list element not found. Skipping population.');
        return;
    }
    branchListDiv.innerHTML = ''; // Clear existing list items

    // Add "All Branches" item
    const allBranchesItem = document.createElement('a');
    allBranchesItem.href = "#";
    allBranchesItem.className = "list-group-item list-group-item-action active";
    allBranchesItem.setAttribute("data-branch-name", "All Branches");
    allBranchesItem.textContent = "All Branches";
    allBranchesItem.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById('dashboardNavLink').classList.add('active'); // Keep dashboard active
        document.querySelectorAll('#branchList .list-group-item').forEach(item => item.classList.remove('active'));
        allBranchesItem.classList.add('active');
        showMainDashboard(); // Go back to main dashboard when "All Branches" is clicked
    });
    branchListDiv.appendChild(allBranchesItem);

    // Get unique branch names from all customer data
    const branches = [...new Set(allCustomerData.map(c => c.BRANCH_FROM_SALESCODE).filter(Boolean))].sort();

    branches.forEach(branch => {
        const branchItem = document.createElement('a');
        branchItem.href = "#";
        branchItem.className = "list-group-item list-group-item-action";
        branchItem.setAttribute("data-branch-name", branch);
        branchItem.textContent = branch;
        branchItem.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
            document.getElementById('branchListToggle').classList.add('active'); 
            document.querySelectorAll('#branchList .list-group-item').forEach(item => item.classList.remove('active'));
            branchItem.classList.add('active'); // Activate specific branch link
            showBranchDetails(branch); // Show branch details page
        });
        branchListDiv.appendChild(branchItem);
    });
}

/**
 * Main function to update all main dashboard components based on the current product filter.
 */
function updateDashboard() {
    let dataToUse = allCustomerData;

    // Apply product filter
    if (currentProductFilter !== 'all') {
        dataToUse = dataToUse.filter(customer => {
            const bundleName = customer.BUNDLE_NAME; // Already uppercased during parsing
            const serviceType = customer.SERVICE_TYPE; // Already uppercased during parsing

            if (currentProductFilter === 'home') {
                return ['BIZNET HOME', 'HOME 0D', 'HOME 1D', 'HOME 2D', 'HOME EMPLOYEE SPN', 'BIZNET PARTNER RESIDENTIAL'].includes(bundleName);
            } else if (currentProductFilter === 'metronet') {
                return ['BIZNET METRONET', 'METRONET 1D', 'METRONET 2D'].includes(bundleName);
            } else if (currentProductFilter === 'enterprise') {
                // For Enterprise, filter by SERVICE_TYPE 'Postpaid'
                return serviceType === 'POSTPAID'; 
            }
            return false;
        });
    }
    console.log(`Updating dashboard for product filter: ${currentProductFilter}. Data count: ${dataToUse.length}`);

    // Update KPIs
    updateMainKPIs(dataToUse);

    // Update Charts
    renderTop5NewDemandChart(dataToUse);
    renderMtdRegistrationStatusChart(dataToUse);
    renderTopNetSubscribersList(dataToUse);
    renderTopTerminateSubscribersList(dataToUse);

    // Hide the inline terminated customers section when the main dashboard updates
    hideInlineTerminatedCustomers();
}

/**
 * Updates the main dashboard KPI cards.
 * @param {Array<Object>} data - The filtered customer data.
 */
function updateMainKPIs(data) {
    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const activeSubscribers = data.filter(c => c.STATUS === 'ACTIVE').length;
    
    // Calculate Suspended Subscribers
    const suspendedSubscribers = data.filter(c => 
        c.STATUS === 'SUSPENDED' 
    ).length;

    // Termination Subscribers: Count customers with STATUS 'TERMINATED' and TERMDATE in the current month
    const terminationSubscribers = data.filter(c => 
        c.STATUS === 'TERMINATED' && 
        c.TERMDATE && c.TERMDATE instanceof Date && 
        c.TERMDATE >= startOfMonth && c.TERMDATE <= today
    ).length;

    document.getElementById('activeSubscribersKpi').textContent = activeSubscribers;
    document.getElementById('suspendedSubscribersKpi').textContent = suspendedSubscribers;
    document.getElementById('terminationSubscribersKpiValue').textContent = terminationSubscribers;
    console.log('KPIs Updated:', { activeSubscribers, suspendedSubscribers, terminationSubscribers });
}

/**
 * Renders the "Top 5 MTD New Subscribers Demand Product" chart.
 * @param {Array<Object>} data - The filtered customer data.
 */
function renderTop5NewDemandChart(data) {
    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const mtdNewCustomers = data.filter(c => 
        c.CONTRACTSTARTDATE && c.CONTRACTSTARTDATE instanceof Date && 
        c.CONTRACTSTARTDATE >= startOfMonth && c.CONTRACTSTARTDATE <= today
    );

    const productDemand = {};
    mtdNewCustomers.forEach(c => {
        const product = c.BUNDLE_NAME || 'Unknown'; // Assuming BUNDLE_NAME for product demand
        productDemand[product] = (productDemand[product] || 0) + 1;
    });

    const sortedProducts = Object.entries(productDemand)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5); // Top 5

    const labels = sortedProducts.map(item => item[0]);
    const chartData = sortedProducts.map(item => item[1]);

    const ctx = document.getElementById('top5NewDemandChart');
    if (!ctx) {
        console.warn('Canvas for top5NewDemandChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (top5NewDemandChart) top5NewDemandChart.destroy();
    top5NewDemandChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Subscribers',
                data: chartData,
                backgroundColor: 'rgba(99, 179, 237, 0.8)', // Biznet blue
                borderColor: 'rgba(99, 179, 237, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Datalabels configuration
                    color: '#ffffff', // Label text color
                    anchor: 'end', // Label position (at the end of the bar)
                    align: 'end', // Label alignment (at the end of the bar)
                    formatter: function(value, context) {
                        return value; // Display data value
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('Top 5 New Demand Chart Rendered.');
}

/**
 * Renders the "MTD Registration Status" chart.
 * @param {Array<Object>} data - The filtered customer data.
 */
function renderMtdRegistrationStatusChart(data) {
    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const mtdRegistrations = data.filter(c => 
        c.CONTRACTSTARTDATE && c.CONTRACTSTARTDATE instanceof Date && 
        c.CONTRACTSTARTDATE >= startOfMonth && c.CONTRACTSTARTDATE <= today
    );

    const statusCounts = {};
    mtdRegistrations.forEach(c => {
        const status = c.STATUS || 'Unknown'; // Assuming STATUS field for registration status
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const chartData = Object.values(statusCounts);

    const ctx = document.getElementById('mtdRegistrationStatusChart');
    if (!ctx) {
        console.warn('Canvas for mtdRegistrationStatusChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (mtdRegistrationStatusChart) mtdRegistrationStatusChart.destroy();
    mtdRegistrationStatusChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'MTD Registrations',
                data: chartData,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)', // Active
                    'rgba(255, 206, 86, 0.8)', // Suspended
                    'rgba(255, 99, 132, 0.8)', // Terminated
                    'rgba(153, 102, 255, 0.8)', // Other statuses
                    'rgba(54, 162, 235, 0.8)'
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(255, 99, 132, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Datalabels configuration
                    color: '#ffffff',
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value, context) {
                        return value;
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('MTD Registration Status Chart Rendered.');
}

/**
 * Renders the "Top 10 Net Subscribers" list.
 * @param {Array<Object>} data - The filtered customer data.
 */
function renderTopNetSubscribersList(data) {
    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const branchNetCounts = {}; // { branchName: { new: 0, terminated: 0 } }

    data.forEach(customer => {
        const branch = customer.BRANCH_FROM_SALESCODE || 'Unknown Branch';
        if (!branchNetCounts[branch]) {
            branchNetCounts[branch] = { new: 0, terminated: 0 };
        }

        if (customer.CONTRACTSTARTDATE && customer.CONTRACTSTARTDATE instanceof Date && 
            customer.CONTRACTSTARTDATE >= startOfMonth && customer.CONTRACTSTARTDATE <= today) {
            branchNetCounts[branch].new++;
        }
        if (customer.STATUS === 'TERMINATED' && 
            customer.TERMDATE && customer.TERMDATE instanceof Date &&
            customer.TERMDATE >= startOfMonth && customer.TERMDATE <= today) {
            branchNetCounts[branch].terminated++;
        }
    });

    const netSubscribers = Object.entries(branchNetCounts).map(([branch, counts]) => ({
        branch: branch,
        net: counts.new - counts.terminated
    }));

    const sortedNetSubscribers = netSubscribers.sort((a, b) => b.net - a.net).slice(0, 10);

    const listElement = document.getElementById('topNetSubscribersList');
    if (!listElement) {
        console.warn('Element topNetSubscribersList not found.');
        return;
    }
    listElement.innerHTML = '';

    if (sortedNetSubscribers.length === 0) {
        listElement.innerHTML = '<li class="text-center text-muted py-4">Tidak ada data Net Subscriber.</li>';
        return;
    }

    sortedNetSubscribers.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'top-list-item';
        listItem.innerHTML = `
            <span>${index + 1}. ${item.branch}</span>
            <span class="value">${item.net}</span>
        `;
        listElement.appendChild(listItem);
    });
    console.log('Top 10 Net Subscribers List Rendered.');
}

/**
 * Renders the "Top 10 Terminate Subscribers" list.
 * @param {Array<Object>} data - The filtered customer data.
 */
function renderTopTerminateSubscribersList(data) {
    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const branchTerminateCounts = {};

    data.forEach(customer => {
        const branch = customer.BRANCH_FROM_SALESCODE || 'Unknown Branch';
        if (!branchTerminateCounts[branch]) {
            branchTerminateCounts[branch] = 0;
        }

        if (customer.STATUS === 'TERMINATED' && 
            customer.TERMDATE && customer.TERMDATE instanceof Date &&
            customer.TERMDATE >= startOfMonth && customer.TERMDATE <= today) {
            branchTerminateCounts[branch]++;
        }
    });

    const terminatedSubscribers = Object.entries(branchTerminateCounts).map(([branch, count]) => ({
        branch: branch,
        count: count
    }));

    const sortedTerminatedSubscribers = terminatedSubscribers.sort((a, b) => b.count - a.count).slice(0, 10);

    const listElement = document.getElementById('topTerminateSubscribersList');
    if (!listElement) {
        console.warn('Element topTerminateSubscribersList not found.');
        return;
    }
    listElement.innerHTML = '';

    if (sortedTerminatedSubscribers.length === 0) {
        listElement.innerHTML = '<li class="text-center text-muted py-4">Tidak ada data Terminate Subscriber.</li>';
        return;
    }

    sortedTerminatedSubscribers.forEach((item, index) => {
        const listItem = document.createElement('li');
        listItem.className = 'top-list-item cursor-pointer hover:bg-gray-700 rounded-md'; // Add cursor and hover effect
        listItem.innerHTML = `
            <span>${index + 1}. ${item.branch}</span>
            <span class="value">${item.count}</span>
        `;
        // Add click event listener to show inline terminated customers
        listItem.addEventListener('click', () => {
            displayInlineTerminatedCustomers(item.branch);
        });
        listElement.appendChild(listItem);
    });
    console.log('Top 10 Terminate Subscribers List Rendered.');
}


/**
 * Shows the main dashboard view and hides the branch detail view.
 * @param {string} branchName - The name of the branch to display details for.
 */
function showBranchDetails(branchName) {
    document.getElementById('mainDashboardView').classList.add('hidden');
    document.getElementById('branchDetailView').classList.remove('hidden');
    hideInlineTerminatedCustomers(); // Hide inline section when navigating to branch details

    currentBranchName = branchName;
    document.getElementById('currentBranchName').textContent = branchName;
    document.getElementById('customerListBranchName').textContent = branchName;
    document.getElementById('salesCodeStatusBranchName').textContent = branchName;
    document.getElementById('bundleNameAnalysisBranchName').textContent = branchName;
    document.getElementById('modemStatusAnalysisBranchName').textContent = branchName; // Set branch name for new section
    document.getElementById('netSubscribersAnalysisBranchName').textContent = branchName; // Set branch name for new section
    document.getElementById('dailyNewSubscribersBranchName').textContent = branchName; // Set branch name for new section
    document.getElementById('dailyTerminationSubscribersBranchName').textContent = branchName; // Set branch name for new section


    // Filter data for the selected branch
    currentBranchData = allCustomerData.filter(customer => 
        customer.BRANCH_FROM_SALESCODE === branchName
    );

    // Reset filters for branch customer list
    resetBranchCustomerFilters(); // This will also call applyBranchCustomerFilters and display the table

    // Populate branch-specific filters
    populateBranchCustomerFilters(currentBranchData);

    // Populate year and month filters for sales code status and bundle name analysis
    populateYearMonthFilters('bundleNameYearFilter', 'bundleNameMonthFilter', currentBranchData);
    populateYearMonthFilters('modemStatusYearFilter', 'modemStatusMonthFilter', currentBranchData, 'CONTRACTSTARTDATE'); // Pass 'CONTRACTSTARTDATE' as the date field for filtering
    populateYearMonthFilters('netSubscribersYearFilter', 'netSubscribersMonthFilter', currentBranchData); // Populate for Net Subscribers
    populateYearMonthFilters('dailyNewYearFilter', 'dailyNewMonthFilter', currentBranchData); // Populate for Daily New Subscribers
    populateYearMonthFilters('dailyTerminationYearFilter', 'dailyTerminationMonthFilter', currentBranchData); // Populate for Daily Termination Subscribers


    // Show the default section (Customer List)
    showBranchDetailSection('customerList');
}

/**
 * Shows a specific section within the branch detail view.
 * @param {string} sectionType - 'customerList', 'salesCodeStatus', 'bundleNameAnalysis', 'modemStatusAnalysis', 'netSubscribersAnalysis', 'dailyNewSubscribers', 'dailyTerminationSubscribers'.
 */
function showBranchDetailSection(sectionType) {
    // Hide all sections first
    document.getElementById('branchCustomerListSection').classList.add('hidden');
    document.getElementById('branchSalesCodeStatusSection').classList.add('hidden');
    document.getElementById('branchBundleNameAnalysisSection').classList.add('hidden');
    document.getElementById('branchModemStatusAnalysisSection').classList.add('hidden'); // Hide new section
    document.getElementById('branchNetSubscribersAnalysisSection').classList.add('hidden'); // Hide new section
    document.getElementById('branchDailyNewSubscribersSection').classList.add('hidden'); // Hide new section
    document.getElementById('branchDailyTerminationSubscribersSection').classList.add('hidden'); // Hide new section


    // Deactivate all sub-navigation buttons
    document.querySelectorAll('.sub-nav-buttons button').forEach(btn => btn.classList.remove('active'));

    // Show the selected section and activate its button
    if (sectionType === 'customerList') {
        document.getElementById('branchCustomerListSection').classList.remove('hidden');
        document.getElementById('showCustomerListBtn').classList.add('active');
        displayBranchCustomers(filteredBranchCustomerData); // Re-display in case of page change
    } else if (sectionType === 'salesCodeStatus') {
        document.getElementById('branchSalesCodeStatusSection').classList.remove('hidden');
        document.getElementById('showSalesCodeStatusBtn').classList.add('active');
        // Call only the overall table for Sales Code Status
        populateBranchSalesCodeStatusOverallTable(currentBranchData); 
    } else if (sectionType === 'bundleNameAnalysis') {
        document.getElementById('branchBundleNameAnalysisSection').classList.remove('hidden');
        document.getElementById('showBundleNameAnalysisBtn').classList.add('active');
        renderBranchBundleNameChart(currentBranchData); // Re-render with current filters
        // Clear the detail table when the section is shown/re-rendered
        const tableBody = document.querySelector('#bundleNameDetailTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan.</td></tr>';
        }
    } else if (sectionType === 'modemStatusAnalysis') { // New section
        document.getElementById('branchModemStatusAnalysisSection').classList.remove('hidden');
        document.getElementById('showModemStatusAnalysisBtn').classList.add('active');
        renderBranchModemStatusChart(currentBranchData);
        // Clear the detail table when the section is shown/re-rendered
        const tableBody = document.querySelector('#modemStatusDetailTable tbody');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bagian donat untuk melihat detail pelanggan.</td></tr>';
        }
    } else if (sectionType === 'netSubscribersAnalysis') { // New section
        document.getElementById('branchNetSubscribersAnalysisSection').classList.remove('hidden');
        document.getElementById('showNetSubscribersAnalysisBtn').classList.add('active');
        renderBranchNetSubscribersChart(currentBranchData);
    } else if (sectionType === 'dailyNewSubscribers') { // New section
        document.getElementById('branchDailyNewSubscribersSection').classList.remove('hidden');
        document.getElementById('showDailyNewSubscribersBtn').classList.add('active');
        renderBranchDailyNewSubscribersChart(currentBranchData);
    } else if (sectionType === 'dailyTerminationSubscribers') { // New section
        document.getElementById('branchDailyTerminationSubscribersSection').classList.remove('hidden');
        document.getElementById('showDailyTerminationSubscribersBtn').classList.add('active');
        renderBranchDailyTerminationChart(currentBranchData);
    }
}

/**
 * Populates filter dropdowns for the branch customer list.
 * @param {Array<Object>} data - The data for the current branch.
 */
function populateBranchCustomerFilters(data) {
    const statusFilter = document.getElementById('customerStatusFilter');
    const salesCodeFilter = document.getElementById('customerSalesCodeFilter');

    if (!statusFilter || !salesCodeFilter) {
        console.warn('Branch customer filter elements not found. Skipping population.');
        return;
    }

    // Store current selections to reapply after repopulating
    const currentSelectedStatus = statusFilter.value;
    const currentSelectedSalesCode = salesCodeFilter.value;

    // Clear existing options
    statusFilter.innerHTML = '<option value="">All Statuses</option>';
    salesCodeFilter.innerHTML = '<option value="">All Sales Codes</option>';

    // Get unique statuses and sales codes from the current branch data
    const statuses = [...new Set(data.map(c => c.STATUS).filter(Boolean))].sort();
    const salesCodes = [...new Set(data.map(c => c.SALESCODE).filter(Boolean))].sort();

    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        statusFilter.appendChild(option);
    });

    salesCodes.forEach(code => {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = code;
        salesCodeFilter.appendChild(option);
    });

    // Reapply previous selections if they still exist in the new options
    if (currentSelectedStatus && statuses.includes(currentSelectedStatus)) {
        statusFilter.value = currentSelectedStatus;
    }
    if (currentSelectedSalesCode && salesCodes.includes(currentSelectedSalesCode)) {
        salesCodeFilter.value = currentSelectedSalesCode;
    }
}

/**
 * Applies filters and search to the branch customer list.
 */
function applyBranchCustomerFilters() {
    const searchInput = document.getElementById('customerSearchInput')?.value.toLowerCase();
    const statusFilter = document.getElementById('customerStatusFilter')?.value;
    const salesCodeFilter = document.getElementById('customerSalesCodeFilter')?.value;

    filteredBranchCustomerData = currentBranchData.filter(customer => {
        // Ensure properties exist before calling toLowerCase()
        const customerEmail = customer.BP_EMAIL ? String(customer.BP_EMAIL).toLowerCase() : '';
        const customerPhone = customer.BP_PHONE ? String(customer.BP_PHONE).toLowerCase() : '';
        // Combine all address parts for search
        const customerAddress = [
            customer.INSTALLATION_ADDRESS1,
            customer.INSTALLATION_ADDRESS2,
            customer.INSTALLATION_ADDRESS3,
            customer.INSTALLATION_ADDRESS4
        ].filter(Boolean).map(addr => String(addr).toLowerCase()).join(' ');

        const matchesSearch = !searchInput || 
                              (customer.BP_FULLNAME && customer.BP_FULLNAME.toLowerCase().includes(searchInput)) ||
                              customerEmail.includes(searchInput) ||
                              (customer.BUSINESSPARTNERID && String(customer.BUSINESSPARTNERID).toLowerCase().includes(searchInput)) ||
                              customerPhone.includes(searchInput) || 
                              customerAddress.includes(searchInput);
        
        const matchesStatus = statusFilter ? (customer.STATUS === statusFilter) : true;
        const matchesSalesCode = salesCodeFilter ? (customer.SALESCODE === salesCodeFilter) : true;

        return matchesSearch && matchesStatus && matchesSalesCode;
    });

    branchCustomerCurrentPage = 1; // Reset to first page
    displayBranchCustomers(filteredBranchCustomerData);
}

/**
 * Resets filters for the branch customer list.
 */
function resetBranchCustomerFilters() {
    document.getElementById('customerSearchInput').value = '';
    document.getElementById('customerStatusFilter').value = '';
    document.getElementById('customerSalesCodeFilter').value = '';
    applyBranchCustomerFilters(); // Apply filters to show all data for the branch
}

/**
 * Displays customer data in the branch customer list table with pagination.
 * @param {Array<Object>} data - The filtered customer data for the branch.
 */
function displayBranchCustomers(data) {
    const tableBody = document.querySelector('#branchCustomerTable tbody');
    if (!tableBody) {
        console.warn('Branch customer table body not found.');
        return;
    }
    tableBody.innerHTML = '';

    const currentPageSpan = document.getElementById('branchCurrentPage');
    const totalPagesSpan = document.getElementById('branchTotalPages');
    const prevPageBtn = document.getElementById('branchPrevPage');
    const nextPageBtn = document.getElementById('branchNextPage');

    const totalPages = Math.ceil(data.length / branchCustomerRowsPerPage);
    
    if (currentPageSpan) currentPageSpan.textContent = branchCustomerCurrentPage;
    if (totalPagesSpan) totalPagesSpan.textContent = totalPages;
    if (prevPageBtn) prevPageBtn.disabled = branchCustomerCurrentPage === 1;
    if (nextPageBtn) nextPageBtn.disabled = branchCustomerCurrentPage === totalPages || totalPages === 0;

    const start = (branchCustomerCurrentPage - 1) * branchCustomerRowsPerPage;
    const end = start + branchCustomerRowsPerPage;
    const paginatedData = data.slice(start, end);

    console.log('Displaying paginated branch customer data:', paginatedData);

    if (paginatedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="10" class="text-center text-muted">Tidak ada data pelanggan yang cocok dengan filter.</td></tr>';
        return;
    }

    paginatedData.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
        row.insertCell().textContent = customer.BP_FULLNAME || '-';
        row.insertCell().textContent = customer.BP_EMAIL || '-';
        row.insertCell().textContent = customer.BP_PHONE || '-';
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.CONTRACTACCOUNT || '-';
        
        // Combine multiple address fields into one for display
        const fullAddress = [
            customer.INSTALLATION_ADDRESS1,
            customer.INSTALLATION_ADDRESS2,
            customer.INSTALLATION_ADDRESS3,
            customer.INSTALLATION_ADDRESS4
        ].filter(Boolean).join(', ');
        row.insertCell().textContent = fullAddress || '-';
        
        row.insertCell().textContent = customer.STATUS || '-';
        
        // Logic for Modem Status
        let modemStatus = customer.MODEM_STATUS || '-';
        if (customer.PROMO_CODE && (customer.PROMO_CODE === 'MODEMPROMO25' || customer.PROMO_CODE === 'MODEMWIFIPROMO')) {
            modemStatus = 'DIPINJAMKAN';
        }
        row.insertCell().textContent = modemStatus;

        // Calculate Subscription Duration for Customer List
        const endDateForDuration = customer.TERMDATE instanceof Date ? customer.TERMDATE : (customer.STATUS === 'ACTIVE' ? new Date() : null);
        const subscriptionDuration = calculateDuration(customer.CONTRACTSTARTDATE, endDateForDuration);
        row.insertCell().textContent = subscriptionDuration;
    });
}

/**
 * Changes the page for the branch customer list table.
 * @param {number} delta - Page change value (-1 for previous, 1 for next).
 */
function changeBranchCustomerPage(delta) {
    const totalPages = Math.ceil(filteredBranchCustomerData.length / branchCustomerRowsPerPage);
    const newPage = branchCustomerCurrentPage + delta;
    if (newPage >= 1 && newPage <= totalPages) {
        branchCustomerCurrentPage = newPage;
        displayBranchCustomers(filteredBranchCustomerData);
    }
}

/**
 * Populates the "Customer Status per Sales Code" overall table for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function populateBranchSalesCodeStatusOverallTable(data) {
    const tableBody = document.querySelector('#salesCodeStatusOverallTable tbody');
    if (!tableBody) {
        console.warn('Sales Code Status Overall table body not found.');
        return;
    }
    tableBody.innerHTML = '';

    const salesCodeMap = {};
    data.forEach(customer => {
        const salesCode = customer.SALESCODE || 'Unknown';
        const status = customer.STATUS || 'UNKNOWN';

        if (!salesCodeMap[salesCode]) {
            salesCodeMap[salesCode] = { Active: 0, Suspended: 0, Terminated: 0, Total: 0 };
        }

        if (status === 'ACTIVE') {
            salesCodeMap[salesCode].Active++;
        } else if (status === 'SUSPENDED') {
            salesCodeMap[salesCode].Suspended++;
        } else if (status === 'TERMINATED') {
            salesCodeMap[salesCode].Terminated++;
        }
        salesCodeMap[salesCode].Total++;
    });

    const salesCodeStatusData = Object.keys(salesCodeMap).sort().map(salesCode => ({
        SalesCode: salesCode,
        ...salesCodeMap[salesCode]
    }));

    if (salesCodeStatusData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data Sales Code keseluruhan untuk cabang ini.</td></tr>';
        return;
    }

    salesCodeStatusData.forEach(item => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = item.SalesCode;
        row.insertCell().textContent = item.Active;
        row.insertCell().textContent = item.Suspended;
        row.insertCell().textContent = item.Terminated;
        row.insertCell().textContent = item.Total;
    });
}

/**
 * Renders the "Analisis Customer per Tipe Bundle Name" chart.
 * @param {Array<Object>} data - The filtered customer data.
 */
function renderBranchBundleNameChart(data) {
    const selectedYear = document.getElementById('bundleNameYearFilter')?.value;
    const selectedMonth = document.getElementById('bundleNameMonthFilter')?.value;

    console.log(`[Bundle Name Chart] Filter Tahun: ${selectedYear}, Filter Bulan: ${selectedMonth}`);

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE;
            if (!contractDate) return false;

            const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
            const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString().padStart(2, '0') === selectedMonth : true; // Added padStart for consistency
            return yearMatch && monthMatch;
        });
    }
    console.log(`[Bundle Name Chart] Jumlah data setelah filter: ${filteredData.length}`);

    const bundleNameCounts = {};
    filteredData.forEach(c => {
        const bundleName = c.BUNDLE_NAME || 'Unknown';
        bundleNameCounts[bundleName] = (bundleNameCounts[bundleName] || 0) + 1;
    });
    console.log('[Bundle Name Chart] Hasil perhitungan bundleNameCounts:', bundleNameCounts);


    const sortedBundleNames = Object.entries(bundleNameCounts)
        .sort(([,a], [,b]) => b - a);

    const labels = sortedBundleNames.map(item => item[0]);
    const chartData = sortedBundleNames.map(item => item[1]);
    console.log('[Bundle Name Chart] Labels untuk grafik:', labels);
    console.log('[Bundle Name Chart] Data untuk grafik:', chartData);


    const ctx = document.getElementById('branchBundleNameChart');
    if (!ctx) {
        console.warn('Canvas for branchBundleNameChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (branchBundleNameChart) branchBundleNameChart.destroy();
    branchBundleNameChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Customer',
                data: chartData,
                backgroundColor: 'rgba(232, 62, 140, 0.8)', // Pink color
                borderColor: 'rgba(232, 62, 140, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Datalabels configuration
                    color: '#ffffff',
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value, context) {
                        return value;
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#cbd5e0',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#cbd5e0',
                        callback: function(value) { if (value % 1 === 0) return value; }
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('Branch Bundle Name Chart Rendered.');

    // Add click event listener to the chart
    ctx.onclick = function(evt) {
        const points = branchBundleNameChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const clickedBundleName = branchBundleNameChart.data.labels[firstPoint.index];
            console.log(`Bundle Name Chart clicked: Bundle ${clickedBundleName}, Year: ${selectedYear}, Month: ${selectedMonth}`);
            displayBundleNameDetail(filteredData, selectedYear, selectedMonth, clickedBundleName);
        } else {
            // If no bar is clicked, clear the table
            const tableBody = document.querySelector('#bundleNameDetailTable tbody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan.</td></tr>';
            }
        }
    };
}

/**
 * Displays detailed bundle name data in the table.
 * @param {Array<Object>} filteredChartData - The data used to render the chart (already filtered by month/year).
 * @param {string} selectedYear - The selected year from the filter.
 * @param {string} selectedMonth - The selected month from the filter.
 * @param {string} clickedBundleName - The bundle name clicked on the chart.
 */
function displayBundleNameDetail(filteredChartData, selectedYear, selectedMonth, clickedBundleName) {
    const tableBody = document.querySelector('#bundleNameDetailTable tbody');
    if (!tableBody) {
        console.warn('Bundle Name Detail table body not found for detail display.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const customersForClickedBundle = filteredChartData.filter(customer => {
        return (customer.BUNDLE_NAME || 'Unknown') === clickedBundleName;
    });

    console.log(`Found ${customersForClickedBundle.length} customers for bundle ${clickedBundleName} in ${selectedMonth}/${selectedYear}.`);

    if (customersForClickedBundle.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="11" class="text-center text-muted">Tidak ada pelanggan dengan bundle ${clickedBundleName} pada bulan ${selectedMonth}/${selectedYear}.</td></tr>`;
        return;
    }

    customersForClickedBundle.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
        row.insertCell().textContent = customer.BP_FULLNAME || '-';
        row.insertCell().textContent = customer.BP_EMAIL || '-';
        row.insertCell().textContent = customer.BP_PHONE || '-';
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.CONTRACTACCOUNT || '-';
        
        const fullAddress = [
            customer.INSTALLATION_ADDRESS1,
            customer.INSTALLATION_ADDRESS2,
            customer.INSTALLATION_ADDRESS3,
            customer.INSTALLATION_ADDRESS4
        ].filter(Boolean).join(', ');
        row.insertCell().textContent = fullAddress || '-';
        
        row.insertCell().textContent = customer.STATUS || '-';
        
        let modemStatus = customer.MODEM_STATUS || '-';
        if (customer.PROMO_CODE && (customer.PROMO_CODE === 'MODEMPROMO25' || customer.PROMO_CODE === 'MODEMWIFIPROMO')) {
            modemStatus = 'DIPINJAMKAN';
        }
        row.insertCell().textContent = modemStatus;

        const endDateForDuration = customer.TERMDATE instanceof Date ? customer.TERMDATE : (customer.STATUS === 'ACTIVE' ? new Date() : null);
        const subscriptionDuration = calculateDuration(customer.CONTRACTSTARTDATE, endDateForDuration);
        row.insertCell().textContent = subscriptionDuration;

        row.insertCell().textContent = customer.CONTRACTSTARTDATE ? customer.CONTRACTSTARTDATE.toLocaleDateString('id-ID') : '-';
    });
}


/**
 * Renders the "Analisis Customer per Status Modem" chart for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchModemStatusChart(data) {
    const selectedYear = document.getElementById('modemStatusYearFilter')?.value;
    const selectedMonth = document.getElementById('modemStatusMonthFilter')?.value;

    console.log(`[Modem Status Chart] Filter Tahun: ${selectedYear}, Filter Bulan: ${selectedMonth}`);

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE;
            // For modem status, we are interested in the status at the time of contract start.
            // If CONTRACTSTARTDATE is not available, we can't filter by it.
            if (!contractDate) return false; 

            const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
            const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString().padStart(2, '0') === selectedMonth : true;
            return yearMatch && monthMatch;
        });
    }
    console.log(`[Modem Status Chart] Jumlah data setelah filter: ${filteredData.length}`);


    const modemStatusCounts = {};
    filteredData.forEach(c => {
        let status = c.MODEM_STATUS || 'TIDAK DIKETAHUI';
        // Apply special logic for promo codes
        if (c.PROMO_CODE && (c.PROMO_CODE === 'MODEMPROMO25' || c.PROMO_CODE === 'MODEMWIFIPROMO')) {
            status = 'MODEM DIPINJAMKAN';
        }
        modemStatusCounts[status] = (modemStatusCounts[status] || 0) + 1;
    });
    console.log('[Modem Status Chart] Hasil perhitungan modemStatusCounts:', modemStatusCounts);


    const labels = Object.keys(modemStatusCounts);
    const chartData = Object.values(modemStatusCounts);
    console.log('[Modem Status Chart] Labels untuk grafik:', labels);
    console.log('[Modem Status Chart] Data untuk grafik:', chartData);


    const ctx = document.getElementById('branchModemStatusChart');
    if (!ctx) {
        console.warn('Canvas for branchModemStatusChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (branchModemStatusChart) branchModemStatusChart.destroy();
    branchModemStatusChart = new Chart(chartCtx, {
        type: 'doughnut', // Use doughnut chart for modem status
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Customer',
                data: chartData,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)', // Red for RENT
                    'rgba(153, 102, 255, 0.8)', // Purple for BUY
                    'rgba(255, 206, 86, 0.8)', // Yellow for TIDAK DIKETAHUI
                    'rgba(54, 162, 235, 0.8)' // Blue for MODEM DIPINJAMKAN
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    position: 'right', // Place legend on the right
                    labels: {
                        color: '#cbd5e0',
                        font: {
                            size: 10
                        }
                    }
                },
                title: {
                    display: false
                },
                datalabels: {
                    color: '#ffffff',
                    formatter: (value, context) => {
                        const total = context.chart.data.datasets[0].data.reduce((sum, val) => sum + val, 0);
                        const percentage = (value / total * 100).toFixed(1) + '%';
                        return percentage;
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            }
        }
    });
    console.log('Branch Modem Status Chart Rendered.');

    // Add click event listener to the chart
    ctx.onclick = function(evt) {
        const points = branchModemStatusChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const clickedStatus = branchModemStatusChart.data.labels[firstPoint.index];
            console.log(`Modem Status Chart clicked: Status ${clickedStatus}, Year: ${selectedYear}, Month: ${selectedMonth}`);

            displayModemStatusDetail(filteredData, selectedYear, selectedMonth, clickedStatus);
        } else {
            // If no segment is clicked, clear the table
            const tableBody = document.querySelector('#modemStatusDetailTable tbody');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bagian donat untuk melihat detail pelanggan.</td></tr>';
            }
        }
    };
}

/**
 * Displays detailed modem status data in the table.
 * @param {Array<Object>} filteredChartData - The data used to render the chart (already filtered by month/year).
 * @param {string} selectedYear - The selected year from the filter.
 * @param {string} selectedMonth - The selected month from the filter.
 * @param {string} clickedStatus - The modem status clicked on the chart.
 */
function displayModemStatusDetail(filteredChartData, selectedYear, selectedMonth, clickedStatus) {
    const tableBody = document.querySelector('#modemStatusDetailTable tbody');
    if (!tableBody) {
        console.warn('Modem Status Detail table body not found for detail display.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const customersForClickedStatus = filteredChartData.filter(customer => {
        let customerModemStatus = customer.MODEM_STATUS || 'TIDAK DIKETAHUI';
        if (customer.PROMO_CODE && (customer.PROMO_CODE === 'MODEMPROMO25' || customer.PROMO_CODE === 'MODEMWIFIPROMO')) {
            customerModemStatus = 'MODEM DIPINJAMKAN';
        }
        return customerModemStatus === clickedStatus;
    });

    console.log(`Found ${customersForClickedStatus.length} customers for status ${clickedStatus} in ${selectedMonth}/${selectedYear}.`);

    if (customersForClickedStatus.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada pelanggan dengan status modem ${clickedStatus} pada bulan ${selectedMonth}/${selectedYear}.</td></tr>`;
        return;
    }

    customersForClickedStatus.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.CONTRACTSTARTDATE ? customer.CONTRACTSTARTDATE.toLocaleDateString('id-ID') : '-';
        row.insertCell().textContent = customer.BP_FULLNAME || '-'; // Full Name
        row.insertCell().textContent = customer.CONTRACTACCOUNT || '-'; // Contract Account
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.MODEM_STATUS || '-'; // Original modem status
        row.insertCell().textContent = customer.PROMO_CODE || '-'; // Promo code
    });
}


/**
 * Renders the "Analisis Net Subscribers per Bulan (Customer Baru, Suspend & Terminated)" chart for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchNetSubscribersChart(data) {
    const selectedYear = document.getElementById('netSubscribersYearFilter')?.value;
    const selectedMonth = document.getElementById('netSubscribersMonthFilter')?.value;

    // Aggregate all data first, then filter labels for display
    const monthlyData = {}; // { 'YYYY-MM': { new: 0, suspended: 0, terminated: 0, net: 0 } }

    data.forEach(c => {
        let monthKeyForNew = null;
        let monthKeyForTerminated = null;
        let monthKeyForSuspended = null;

        if (c.CONTRACTSTARTDATE instanceof Date) {
            monthKeyForNew = `${c.CONTRACTSTARTDATE.getFullYear()}-${(c.CONTRACTSTARTDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        if (c.TERMDATE instanceof Date && c.STATUS === 'TERMINATED') {
            monthKeyForTerminated = `${c.TERMDATE.getFullYear()}-${(c.TERMDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        // Count suspended based on EXPIREDDATE if customer is currently suspended
        if (c.EXPIREDDATE instanceof Date && c.STATUS === 'SUSPENDED') {
            monthKeyForSuspended = `${c.EXPIREDDATE.getFullYear()}-${(c.EXPIREDDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        // Ensure all relevant month keys are initialized in monthlyData
        const relevantMonthKeys = new Set();
        if (monthKeyForNew) relevantMonthKeys.add(monthKeyForNew);
        if (monthKeyForTerminated) relevantMonthKeys.add(monthKeyForTerminated);
        if (monthKeyForSuspended) relevantMonthKeys.add(monthKeyForSuspended);

        relevantMonthKeys.forEach(key => {
            if (!monthlyData[key]) {
                monthlyData[key] = { new: 0, suspended: 0, terminated: 0, net: 0 };
            }
        });

        // Increment counts based on the specific event's month
        if (monthKeyForNew) {
            monthlyData[monthKeyForNew].new++;
        }
        if (monthKeyForSuspended) {
            monthlyData[monthKeyForSuspended].suspended++;
        }
        if (monthKeyForTerminated) {
            monthlyData[monthKeyForTerminated].terminated++;
        }
    });

    // Calculate net for each month after all counts are tallied
    Object.keys(monthlyData).forEach(monthKey => {
        monthlyData[monthKey].net = monthlyData[monthKey].new - monthlyData[monthKey].terminated;
    });

    // Determine labels based on filters
    let labels = [];
    if (selectedYear && selectedMonth) {
        // Specific month selected: show only that month
        labels.push(`${selectedYear}-${selectedMonth}`);
    } else if (selectedYear) {
        // Only year selected: show all 12 months for that year
        const startYear = parseInt(selectedYear);
        for (let m = 1; m <= 12; m++) {
            labels.push(`${startYear}-${m.toString().padStart(2, '0')}`);
        }
    } else {
        // No year/month selected: default to the latest available year in the data
        const allYears = [...new Set(Object.keys(monthlyData).map(key => parseInt(key.split('-')[0])))].sort((a, b) => b - a);
        const defaultYear = allYears.length > 0 ? allYears[0] : new Date().getFullYear();
        for (let m = 1; m <= 12; m++) {
            labels.push(`${defaultYear}-${m.toString().padStart(2, '0')}`);
        }
    }

    // Sort labels chronologically
    labels.sort();

    // Prepare chart data based on the determined labels
    const newCustomersData = labels.map(monthKey => (monthlyData[monthKey] ? monthlyData[monthKey].new : 0));
    const suspendedData = labels.map(monthKey => (monthlyData[monthKey] ? monthlyData[monthKey].suspended : 0));
    const terminatedData = labels.map(monthKey => (monthlyData[monthKey] ? monthlyData[monthKey].terminated : 0));
    const netSubsData = labels.map(monthKey => (monthlyData[monthKey] ? monthlyData[monthKey].net : 0));

    // Convert 'YYYY-MM' labels to 'Bulan YYYY' for display
    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const displayLabels = labels.map(label => {
        const [year, month] = label.split('-');
        return `${monthNames[parseInt(month) - 1]} ${year}`;
    });

    const ctx = document.getElementById('branchNetSubscribersChart');
    if (!ctx) {
        console.warn('Canvas for branchNetSubscribersChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (branchNetSubscribersChart) branchNetSubscribersChart.destroy();
    branchNetSubscribersChart = new Chart(chartCtx, {
        type: 'line',
        data: {
            labels: displayLabels, // Use displayLabels here for formatted month names
            datasets: [
                {
                    label: 'Customer Baru',
                    data: newCustomersData,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Terminated',
                    data: terminatedData,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Suspended',
                    data: suspendedData,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.2)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Net Subs',
                    data: netSubsData,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#cbd5e0',
                        font: {
                            size: 10
                        }
                    }
                },
                title: {
                    display: false
                },
                datalabels: {
                    display: false // Hide datalabels for line chart to avoid clutter
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#cbd5e0',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#cbd5e0',
                        callback: function(value) { if (value % 1 === 0) return value; }
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('Branch Net Subscribers Chart Rendered.');

    // Populate the table below the chart
    // The table should also reflect the labels generated for the chart
    const tableData = labels.map(monthKey => ({
        monthKey: monthKey,
        data: monthlyData[monthKey] || { new: 0, suspended: 0, terminated: 0, net: 0 }
    }));
    populateNetSubscribersDetailTable(tableData, displayLabels); // Pass tableData and displayLabels
}

/**
 * Populates the table for Net Subscribers data.
 * @param {Array<Object>} tableData - The aggregated data for each month, with monthKey.
 * @param {Array<string>} displayLabels - Formatted labels for display (e.g., "Januari 2025").
 */
function populateNetSubscribersDetailTable(tableData, displayLabels) {
    const tableBody = document.querySelector('#netSubscribersDetailTable tbody');
    if (!tableBody) {
        console.warn('Net Subscribers Detail table body not found.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    if (tableData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data Net Subscribers untuk filter yang dipilih.</td></tr>';
        return;
    }

    tableData.forEach((item, index) => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = displayLabels[index]; // Use the formatted display label
        row.insertCell().textContent = item.data.new;
        row.insertCell().textContent = item.data.terminated;
        row.insertCell().textContent = item.data.suspended;
        row.insertCell().textContent = item.data.net;
    });
}


/**
 * Renders the "Daily New Subscribers" chart and table for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchDailyNewSubscribersChart(data) {
    const selectedYear = document.getElementById('dailyNewYearFilter')?.value;
    const selectedMonth = document.getElementById('dailyNewMonthFilter')?.value;

    console.log(`renderBranchDailyNewSubscribersChart: Year Filter: ${selectedYear}, Month Filter: ${selectedMonth}`);

    let filteredData = data.filter(customer => {
        const contractDate = customer.CONTRACTSTARTDATE;
        if (!contractDate) return false;

        const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
        const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString().padStart(2, '0') === selectedMonth : true;
        
        return yearMatch && monthMatch;
    });

    const dailyNewSubscribers = filteredData.filter(c => 
        c.CONTRACTSTARTDATE && c.CONTRACTSTARTDATE instanceof Date
    );
    console.log(`Total dailyNewSubscribers after year/month filter: ${dailyNewSubscribers.length}`);


    const dailyCounts = {}; // { 'YYYY-MM-DD': count }
    dailyNewSubscribers.forEach(c => {
        // Normalize CONTRACTSTARTDATE to start of day for key
        const normalizedDate = new Date(c.CONTRACTSTARTDATE);
        normalizedDate.setHours(0, 0, 0, 0);
        // Use toLocaleDateString('en-CA') for ISO-MM-DD format
        const dateKey = normalizedDate.toLocaleDateString('en-CA'); 
        dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });
    console.log('Daily Counts for chart:', dailyCounts);

    // Generate all days for the selected month to ensure continuous labels
    const year = parseInt(selectedYear || (latestAvailableDataDate ? latestAvailableDataDate.getFullYear() : new Date().getFullYear()));
    const month = parseInt(selectedMonth || (latestAvailableDataDate ? latestAvailableDataDate.getMonth() + 1 : new Date().getMonth() + 1));
    const daysInMonth = new Date(year, month, 0).getDate();

    const labels = [];
    const chartData = [];
    for (let i = 1; i <= daysInMonth; i++) {
        const day = i.toString().padStart(2, '0');
        const monthStr = month.toString().padStart(2, '0');
        // Key to look up data in dailyCounts must match ISO-MM-DD format
        const dateKey = `${year}-${monthStr}-${day}`; 
        labels.push(i); // Just the day number for x-axis
        chartData.push(dailyCounts[dateKey] || 0);
    }
    console.log('Chart Labels (Days):', labels);
    console.log('Chart Data (Counts per day):', chartData);

    const ctx = document.getElementById('branchDailyNewSubscribersChart');
    if (!ctx) {
        console.warn('Canvas for branchDailyNewSubscribersChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (branchDailyNewSubscribersChart) branchDailyNewSubscribersChart.destroy();
    branchDailyNewSubscribersChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'New Subscribers (MoM)',
                data: chartData,
                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: {
                    color: '#ffffff',
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value, context) {
                        return value > 0 ? value : ''; // Only show label if value > 0
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal',
                        color: '#cbd5e0'
                    },
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Customer Baru',
                        color: '#cbd5e0'
                    },
                    ticks: {
                        color: '#cbd5e0',
                        callback: function(value) { if (value % 1 === 0) return value; }
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('Branch Daily New Subscribers Chart Rendered.');

    // Update KPI for total new customers for the selected month
    const totalNewCustomersMonth = dailyNewSubscribers.length;
    document.getElementById('totalNewCustomersKpi').textContent = totalNewCustomersMonth;

    // Initially clear the table until a bar is clicked
    const tableBody = document.querySelector('#dailyNewSubscribersTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan baru harian.</td></tr>';
    }

    // Add click event listener to the chart
    ctx.onclick = function(evt) {
        const points = branchDailyNewSubscribersChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const label = branchDailyNewSubscribersChart.data.labels[firstPoint.index];
            const clickedDay = parseInt(label);
            console.log(`Chart clicked: Day ${clickedDay}, Year: ${selectedYear}, Month: ${selectedMonth}`);

            displayDailyNewSubscribersDetail(dailyNewSubscribers, selectedYear, selectedMonth, clickedDay);
        } else {
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan baru harian.</td></tr>';
            }
        }
    };
}

/**
 * Displays detailed daily new subscribers data in the table.
 * @param {Array<Object>} dailyNewSubscribersData - The filtered daily new subscribers data (already filtered by month/year).
 * @param {string} selectedYear - The selected year from the filter.
 * @param {string} selectedMonth - The selected month from the filter.
 * @param {number} clickedDay - The day clicked on the chart.
 */
function displayDailyNewSubscribersDetail(dailyNewSubscribersData, selectedYear, selectedMonth, clickedDay) {
    const tableBody = document.querySelector('#dailyNewSubscribersTable tbody');
    if (!tableBody) {
        console.warn('Daily New Subscribers table body not found for detail display.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    // Construct the target date for comparison, ensuring consistency (midnight UTC or local, depending on data)
    const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, clickedDay);
    targetDate.setHours(0, 0, 0, 0); // Normalize target date to start of day
    const targetDateString = targetDate.toLocaleDateString('en-CA'); // Use toLocaleDateString('en-CA') for consistent ISO-MM-DD format

    const customersForClickedDay = dailyNewSubscribersData.filter(customer => {
        if (!customer.CONTRACTSTARTDATE) {
            console.log('Skipping customer due to missing CONTRACTSTARTDATE');
            return false;
        }
        // Normalize customer date to start of day and get ISO-MM-DD string
        const customerDate = new Date(customer.CONTRACTSTARTDATE);
        customerDate.setHours(0, 0, 0, 0); 
        const customerDateString = customerDate.toLocaleDateString('en-CA');
        
        return customerDateString === targetDateString;
    });

    console.log(`Found ${customersForClickedDay.length} customers for clicked day ${clickedDay}/${selectedMonth}/${selectedYear}.`);

    if (customersForClickedDay.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada pelanggan baru pada tanggal ${clickedDay}/${selectedMonth}/${selectedYear}.</td></tr>`;
        return;
    }

    customersForClickedDay.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.CONTRACTSTARTDATE ? customer.CONTRACTSTARTDATE.toLocaleDateString('id-ID') : '-';
        row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
        row.insertCell().textContent = customer.BP_FULLNAME || '-';
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.STATUS || '-';
        row.insertCell().textContent = customer.CONTRACTSTARTDATE ? customer.CONTRACTSTARTDATE.toLocaleDateString('id-ID') : '-';
    });
}

/**
 * Renders the "Daily Termination Subscribers (MoM & Forecast)" chart and table for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchDailyTerminationChart(data) {
    const selectedYear = document.getElementById('dailyTerminationYearFilter')?.value;
    const selectedMonth = document.getElementById('dailyTerminationMonthFilter')?.value;

    console.log(`renderBranchDailyTerminationChart: Year Filter: ${selectedYear}, Month Filter: ${selectedMonth}`);

    let filteredData = data.filter(customer => {
        const termDate = customer.TERMDATE;
        const expiredDate = customer.EXPIREDDATE; // For forecast

        // Include customers with TERMDATE or EXPIREDDATE within the selected month/year
        const yearMatch = selectedYear ? (termDate && termDate.getFullYear().toString() === selectedYear) || (expiredDate && expiredDate.getFullYear().toString() === selectedYear) : true;
        const monthMatch = selectedMonth ? (termDate && (termDate.getMonth() + 1).toString().padStart(2, '0') === selectedMonth) || (expiredDate && (expiredDate.getMonth() + 1).toString().padStart(2, '0') === selectedMonth) : true;
        
        return yearMatch && monthMatch;
    });

    const dailyTerminationCounts = {}; // { 'YYYY-MM-DD': count }
    const dailyForecastCounts = {}; // { 'YYYY-MM-DD': count }

    filteredData.forEach(c => {
        // Actual terminations
        if (c.STATUS === 'TERMINATED' && c.TERMDATE instanceof Date) {
            const normalizedDate = new Date(c.TERMDATE);
            normalizedDate.setHours(0, 0, 0, 0);
            const dateKey = normalizedDate.toLocaleDateString('en-CA');
            dailyTerminationCounts[dateKey] = (dailyTerminationCounts[dateKey] || 0) + 1;
        }
        // Forecast terminations (based on EXPIREDDATE for non-terminated active/suspended customers)
        else if (c.EXPIREDDATE instanceof Date && (c.STATUS === 'ACTIVE' || c.STATUS === 'SUSPENDED')) {
            const normalizedDate = new Date(c.EXPIREDDATE);
            normalizedDate.setHours(0, 0, 0, 0);
            const dateKey = normalizedDate.toLocaleDateString('en-CA');
            dailyForecastCounts[dateKey] = (dailyForecastCounts[dateKey] || 0) + 1;
        }
    });
    console.log('Daily Termination Counts for chart:', dailyTerminationCounts);
    console.log('Daily Forecast Counts for chart:', dailyForecastCounts);

    const year = parseInt(selectedYear || (latestAvailableDataDate ? latestAvailableDataDate.getFullYear() : new Date().getFullYear()));
    const month = parseInt(selectedMonth || (latestAvailableDataDate ? latestAvailableDataDate.getMonth() + 1 : new Date().getMonth() + 1));
    const daysInMonth = new Date(year, month, 0).getDate();

    const labels = [];
    const terminationChartData = [];
    const forecastChartData = [];
    let totalActiveTerminations = 0;
    let totalForecastTerminations = 0;

    for (let i = 1; i <= daysInMonth; i++) {
        const day = i.toString().padStart(2, '0');
        const monthStr = month.toString().padStart(2, '0');
        const dateKey = `${year}-${monthStr}-${day}`; 
        labels.push(i);

        const terminationCount = dailyTerminationCounts[dateKey] || 0;
        const forecastCount = dailyForecastCounts[dateKey] || 0;

        terminationChartData.push(terminationCount);
        forecastChartData.push(forecastCount);

        totalActiveTerminations += terminationCount;
        totalForecastTerminations += forecastCount;
    }
    console.log('Termination Chart Labels (Days):', labels);
    console.log('Termination Chart Data (Counts per day):', terminationChartData);
    console.log('Forecast Chart Data (Counts per day):', forecastChartData);

    const ctx = document.getElementById('branchDailyTerminationChart');
    if (!ctx) {
        console.warn('Canvas for branchDailyTerminationChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    if (branchDailyTerminationChart) branchDailyTerminationChart.destroy();
    branchDailyTerminationChart = new Chart(chartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Termination (MoM)',
                    data: terminationChartData,
                    backgroundColor: 'rgba(255, 99, 132, 0.8)', // Red for terminations
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Forecast Termination',
                    data: forecastChartData,
                    backgroundColor: 'rgba(255, 206, 86, 0.8)', // Yellow for forecast
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Allow chart-container to control height
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#cbd5e0',
                        font: {
                            size: 10
                        }
                    }
                },
                title: {
                    display: false
                },
                datalabels: {
                    color: '#ffffff',
                    anchor: 'end',
                    align: 'end',
                    formatter: function(value, context) {
                        return value > 0 ? value : '';
                    },
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tanggal',
                        color: '#cbd5e0'
                    },
                    ticks: {
                        color: '#cbd5e0'
                    },
                    grid: {
                        color: '#4a5568'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Jumlah Customer',
                        color: '#cbd5e0'
                    },
                    ticks: {
                        color: '#cbd5e0',
                        callback: function(value) { if (value % 1 === 0) return value; }
                    },
                    grid: {
                        color: '#4a5568'
                    }
                }
            }
        }
    });
    console.log('Branch Daily Termination Chart Rendered.');

    document.getElementById('totalActiveTerminationsKpi').textContent = totalActiveTerminations;
    document.getElementById('totalForecastTerminationsKpi').textContent = totalForecastTerminations;

    const tableBody = document.querySelector('#dailyTerminationSubscribersTable tbody');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan terminasi harian.</td></tr>';
    }

    ctx.onclick = function(evt) {
        const points = branchDailyTerminationChart.getElementsAtEventForMode(evt, 'nearest', { intersect: true }, true);
        if (points.length) {
            const firstPoint = points[0];
            const label = branchDailyTerminationChart.data.labels[firstPoint.index];
            const clickedDay = parseInt(label);
            console.log(`Termination Chart clicked: Day ${clickedDay}, Year: ${selectedYear}, Month: ${selectedMonth}`);

            displayDailyTerminationSubscribersDetail(filteredData, selectedYear, selectedMonth, clickedDay);
        } else {
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Klik bar pada grafik untuk melihat detail pelanggan terminasi harian.</td></tr>';
            }
        }
    };
}


/**
 * Displays detailed daily termination subscribers data in the table.
 * @param {Array<Object>} allFilteredData - All filtered data for the selected month/year (includes active, suspended, terminated).
 * @param {string} selectedYear - The selected year from the filter.
 * @param {string} selectedMonth - The selected month from the filter.
 * @param {number} clickedDay - The day clicked on the chart.
 */
function displayDailyTerminationSubscribersDetail(allFilteredData, selectedYear, selectedMonth, clickedDay) {
    const tableBody = document.querySelector('#dailyTerminationSubscribersTable tbody');
    if (!tableBody) {
        console.warn('Daily Termination Subscribers table body not found for detail display.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, clickedDay);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateString = targetDate.toLocaleDateString('en-CA');

    const customersForClickedDay = allFilteredData.filter(customer => {
        let customerDate = null;

        if (customer.STATUS === 'TERMINATED' && customer.TERMDATE instanceof Date) {
            customerDate = new Date(customer.TERMDATE);
        } else if (customer.EXPIREDDATE instanceof Date && (customer.STATUS === 'ACTIVE' || customer.STATUS === 'SUSPENDED')) {
            customerDate = new Date(customer.EXPIREDDATE);
        }

        if (!customerDate) return false;

        customerDate.setHours(0, 0, 0, 0);
        const customerDateString = customerDate.toLocaleDateString('en-CA');

        return customerDateString === targetDateString;
    });

    console.log(`Found ${customersForClickedDay.length} customers for clicked termination day ${clickedDay}/${selectedMonth}/${selectedYear}.`);

    if (customersForClickedDay.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Tidak ada pelanggan terminasi atau perkiraan terminasi pada tanggal ${clickedDay}/${selectedMonth}/${selectedYear}.</td></tr>`;
        return;
    }

    customersForClickedDay.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.BP_FULLNAME || '-';
        row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.STATUS || '-';
        row.insertCell().textContent = customer.EXPIREDDATE ? customer.EXPIREDDATE.toLocaleDateString('id-ID') : '-';
        row.insertCell().textContent = customer.TERMDATE ? customer.TERMDATE.toLocaleDateString('id-ID') : '-';
    });
}


/**
 * Populates the year and month filter dropdowns for a given section.
 * @param {string} yearSelectId - The ID of the year select element.
 * @param {string} monthSelectId - The ID of the month select element.
 * @param {Array<Object>} data - The data to extract years and months from.
 * @param {string} dateField - The field name in the customer object to use for date filtering (e.g., 'CONTRACTSTARTDATE', 'TERMDATE').
 */
function populateYearMonthFilters(yearSelectId, monthSelectId, data, dateField = 'CONTRACTSTARTDATE') {
    const yearSelect = document.getElementById(yearSelectId);
    const monthSelect = document.getElementById(monthSelectId);

    if (!yearSelect || !monthSelect) {
        console.warn(`Year/Month filter elements with IDs ${yearSelectId} or ${monthSelectId} not found.`);
        return;
    }

    // Store current selections to reapply after repopulating
    const currentSelectedYear = yearSelect.value;
    const currentSelectedMonth = monthSelect.value;

    yearSelect.innerHTML = '<option value="">All Years</option>';
    monthSelect.innerHTML = '<option value="">All Months</option>';

    const years = new Set();
    const months = new Set();

    data.forEach(customer => {
        const date = customer[dateField];
        if (date instanceof Date) {
            years.add(date.getFullYear());
            months.add(date.getMonth() + 1); // Month is 0-indexed, so add 1
        }
    });

    [...years].sort((a, b) => b - a).forEach(year => { // Sort descending for years
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    [...months].sort((a, b) => a - b).forEach(monthNum => { // Sort ascending for months
        const option = document.createElement('option');
        option.value = monthNum.toString().padStart(2, '0'); // Ensure month is '01', '02' etc.
        option.textContent = monthNames[monthNum - 1]; // Adjust for 0-indexed array
        monthSelect.appendChild(option);
    });

    // Reapply previous selections if they still exist in the new options
    if (currentSelectedYear && [...years].includes(parseInt(currentSelectedYear))) {
        yearSelect.value = currentSelectedYear;
    }
    if (currentSelectedMonth && [...months].includes(parseInt(currentSelectedMonth))) {
        monthSelect.value = currentSelectedMonth;
    } else {
        // If no month was previously selected or the month is no longer available,
        // set to the current month if available, or "All Months"
        const currentMonthNum = new Date().getMonth() + 1;
        if ([...months].includes(currentMonthNum)) {
            monthSelect.value = currentMonthNum.toString().padStart(2, '0');
        } else {
            monthSelect.value = ""; // Default to "All Months"
        }
    }
}

/**
 * Displays an inline section with a list of terminated customers for a specific branch or all branches.
 * @param {string} branchName - The name of the branch to filter by, or 'All Branches' for no branch filter.
 */
function displayInlineTerminatedCustomers(branchName) {
    const inlineSection = document.getElementById('inlineTerminatedCustomersSection');
    const sectionTitle = document.getElementById('inlineTerminatedCustomersTitle');
    const tableBody = document.querySelector('#inlineTerminatedCustomersTable tbody');

    if (!inlineSection || !sectionTitle || !tableBody) {
        console.error('Inline terminated customers section elements not found. Skipping display.');
        return;
    }

    sectionTitle.textContent = `Detail Pelanggan Terminasi untuk ${branchName}`;
    tableBody.innerHTML = ''; // Clear previous data

    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    let terminatedCustomers = allCustomerData.filter(customer => 
        customer.STATUS === 'TERMINATED' &&
        customer.TERMDATE && customer.TERMDATE instanceof Date &&
        customer.TERMDATE >= startOfMonth && customer.TERMDATE <= today
    );

    if (branchName !== 'All Branches') {
        terminatedCustomers = terminatedCustomers.filter(customer => 
            customer.BRANCH_FROM_SALESCODE === branchName
        );
    }

    console.log(`Terminated Customers for display (${branchName}):`, terminatedCustomers);


    if (terminatedCustomers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Tidak ada pelanggan TERMINATED untuk filter yang dipilih di bulan ini.</td></tr>';
    } else {
        terminatedCustomers.forEach(customer => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = customer.BP_FULLNAME || '-';
            row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
            row.insertCell().textContent = customer.BP_PHONE || '-'; 
            row.insertCell().textContent = customer.TERMDATE ? customer.TERMDATE.toLocaleDateString('id-ID') : '-';
            
            // Calculate Subscription Duration
            const subscriptionDuration = calculateDuration(customer.CONTRACTSTARTDATE, customer.TERMDATE);
            row.insertCell().textContent = subscriptionDuration;

            // Determine Modem Status
            let modemStatus = customer.MODEM_STATUS || '-';
            if (customer.PROMO_CODE && (customer.PROMO_CODE === 'MODEMPROMO25' || customer.PROMO_CODE === 'MODEMWIFIPROMO')) {
                modemStatus = 'DIPINJAMKAN';
            }
            row.insertCell().textContent = modemStatus;

            row.insertCell().textContent = customer.CONTRACTACCOUNT || '-';
        });
    }

    inlineSection.classList.remove('hidden');
    inlineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Hides the inline terminated customers section.
 */
function hideInlineTerminatedCustomers() {
    const inlineSection = document.getElementById('inlineTerminatedCustomersSection');
    if (inlineSection) {
        inlineSection.classList.add('hidden');
    }
}
