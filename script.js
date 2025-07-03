// script.js
// URL Google Apps Script Anda yang akan mengembalikan data pelanggan dalam format JSON.
// PASTIKAN URL INI BENAR dan Apps Script Anda di-deploy dengan akses "Anyone".
const DATA_URL = 'https://script.google.com/macros/s/AKfycbzkV_Z8qbvCw--RYaOTDBYia9DKob0Du5J9c47JCKr3zmr8_6AI0QPle6UgituFTs3hJA/exec';

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
            if (branchList.style.display === 'none' || branchList.style.display === '') {
                branchList.style.display = 'block';
                branchToggleIcon.classList.remove('fa-chevron-down');
                branchToggleIcon.classList.add('fa-chevron-up');
            } else {
                branchList.style.display = 'none';
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

    // Event listeners for Sales Code Status filters
    document.getElementById('salesCodeYearFilter')?.addEventListener('change', () => populateBranchSalesCodeStatusTable(currentBranchData));
    document.getElementById('salesCodeMonthFilter')?.addEventListener('change', () => populateBranchSalesCodeStatusTable(currentBranchData));

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
    document.getElementById('dailyTerminationMonthFilter')?.addEventListener('change', () => renderBranchDailyTerminationChart(currentBranchData));


    // Event listener for Dashboard Nav Link
    document.getElementById('dashboardNavLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showMainDashboard();
        // Update active state in sidebar
        document.querySelectorAll('.sidebar-nav a').forEach(link => link.classList.remove('active'));
        document.getElementById('dashboardNavLink').classList.add('active');
        const allBranchesItem = document.getElementById('branchList').querySelector('[data-branch-name="All Branches"]');
        if (allBranchesItem) allBranchesItem.classList.add('active'); // Keep All Branches active in sidebar
    });

    // Event listener for closing the inline terminated customers section
    document.getElementById('closeInlineTerminatedCustomersBtn')?.addEventListener('click', hideInlineTerminatedCustomers);
});

/**
 * Shows the main dashboard view and hides the branch detail view.
 */
function showMainDashboard() {
    document.getElementById('mainDashboardView').style.display = 'block';
    document.getElementById('branchDetailView').style.display = 'none';
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
    document.querySelectorAll('.header button').forEach(button => {
        button.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        button.classList.add('bg-gray-600', 'hover:bg-gray-700');
    });
    // Ensure the correct button ID is targeted
    let targetButtonId = `filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}Products`;
    if (filterType === 'all') { // Special case for 'all' as it's not 'AllProducts'
        targetButtonId = 'filterAllProducts';
    }
    document.getElementById(targetButtonId)?.classList.remove('bg-gray-600', 'hover:bg-gray-700');
    document.getElementById(targetButtonId)?.classList.add('bg-blue-600', 'hover:bg-blue-700');
    
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
        
        allCustomerData = await response.json();
        console.log('Parsed customer data:', allCustomerData);

        if (!Array.isArray(allCustomerData) || allCustomerData.length === 0) {
            console.warn('Data fetched is empty or not an array. Displaying empty dashboard.');
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.innerHTML = '<p class="text-center text-info mt-5">Tidak ada data pelanggan yang tersedia. Mohon periksa sumber data Anda.</p>';
            }
            hideLoading();
            return;
        }

        // Ensure date fields are converted to Date objects for easier manipulation.
        let tempLatestDate = null;

        allCustomerData.forEach(customer => {
            const processDateField = (dateValue, fieldName) => {
                if (!dateValue) return null;
                const date = new Date(dateValue);
                // Basic validation for date sanity (e.g., year within reasonable range)
                if (isNaN(date.getTime()) || date.getFullYear() > 2100 || date.getFullYear() < 1900) {
                    console.warn(`Invalid or out-of-range date detected for ${fieldName}: ${dateValue}. Skipping.`);
                    return null;
                }
                // Normalisasi ke awal hari (00:00:00) di zona waktu lokal
                date.setHours(0, 0, 0, 0); 
                return date;
            };

            customer.CONTRACTSTARTDATE = processDateField(customer.CONTRACTSTARTDATE, 'CONTRACTSTARTDATE');
            customer.EXPIREDDATE = processDateField(customer.EXPIREDDATE, 'EXPIREDDATE');
            customer.TERMDATE = processDateField(customer.TERMDATE, 'TERMDATE');
            customer.LASTPAYMENTDATE = processDateField(customer.LASTPAYMENTDATE, 'LASTPAYMENTDATE');

            const now = new Date();
            now.setHours(0, 0, 0, 0);

            // Determine the latest available date from relevant date fields
            if (customer.CONTRACTSTARTDATE && customer.CONTRACTSTARTDATE <= now && (!tempLatestDate || customer.CONTRACTSTARTDATE > tempLatestDate)) {
                tempLatestDate = customer.CONTRACTSTARTDATE;
            }
            if (customer.TERMDATE && customer.TERMDATE <= now && (!tempLatestDate || customer.TERMDATE > tempLatestDate)) {
                tempLatestDate = customer.TERMDATE;
            }
            if (customer.LASTPAYMENTDATE && customer.LASTPAYMENTDATE <= now && (!tempLatestDate || customer.LASTPAYMENTDATE > tempLatestDate)) {
                tempLatestDate = customer.LASTPAYMENTDATE;
            }
        });
        latestAvailableDataDate = tempLatestDate;
        console.log('Latest available data date after robust processing:', latestAvailableDataDate ? latestAvailableDataDate.toLocaleDateString('id-ID') : 'N/A');

        // Initial dashboard update with all data
        updateDashboard();
        populateBranchesList();

        const lastUpdateDateElement = document.getElementById('lastUpdateDate');
        if (lastUpdateDateElement) {
            lastUpdateDateElement.textContent = latestAvailableDataDate ? 
                `Data per: ${latestAvailableDataDate.toLocaleString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}` : 
                'Data tidak tersedia';
        }

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
            mainContent.innerHTML = `<p class="text-center text-danger mt-5">${errorMessage}</p>`;
        } else {
            // Fallback for cases where mainContent is not available
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
 * Populates global filter dropdown options (Service Type, Status) based on available data.
 * This is a placeholder for now as global filters are not currently in the HTML.
 */
function populateGlobalFilters() {
    // This function can be re-enabled and connected to HTML elements if global filters are re-introduced.
    console.log('Populating global filters (function present but not used by current HTML).');
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
            document.getElementById('branchListToggle').classList.add('active'); // Activate main Branches link
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
            const bundleName = customer.BUNDLE_NAME ? customer.BUNDLE_NAME.toUpperCase() : '';
            const serviceType = customer.SERVICE_TYPE ? customer.SERVICE_TYPE.toUpperCase() : '';

            if (currentProductFilter === 'home') {
                return ['BIZNET HOME', 'HOME 0D', 'HOME 1D', 'HOME 2D', 'HOME EMPLOYEE SPN', 'BIZNET PARTNER RESIDENTIAL'].includes(bundleName);
            } else if (currentProductFilter === 'metronet') {
                return ['BIZNET METRONET', 'METRONET 1D', 'METRONET 2D'].includes(bundleName);
            } else if (currentProductFilter === 'enterprise') {
                // For Enterprise, filter by SERVICE_TYPE 'Postpaid'
                return serviceType === 'POSTPAID'; 
            }
            return false; // Should not happen for 'all'
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

    const activeSubscribers = data.filter(c => c.STATUS && c.STATUS.toUpperCase() === 'ACTIVE').length;
    
    // Calculate Suspended Subscribers
    const suspendedSubscribers = data.filter(c => 
        c.STATUS && c.STATUS.toUpperCase() === 'SUSPENDED' 
    ).length;

    // Termination Subscribers: Count customers with STATUS 'TERMINATED' and TERMDATE in the current month
    const terminationSubscribers = data.filter(c => 
        c.STATUS && c.STATUS.toUpperCase() === 'TERMINATED' && 
        c.TERMDATE && c.TERMDATE instanceof Date && 
        c.TERMDATE >= startOfMonth && c.TERMDATE <= today
    ).length;

    document.getElementById('activeSubscribersKpi').textContent = activeSubscribers;
    // Update the Suspended Subscribers KPI
    document.getElementById('suspendedSubscribersKpi').textContent = suspendedSubscribers;
    document.getElementById('terminationSubscribersKpi').textContent = terminationSubscribers;

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
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Konfigurasi datalabels
                    color: '#ffffff', // Warna teks label
                    anchor: 'end', // Posisi label (di akhir bar)
                    align: 'end', // Penjajaran label (di akhir bar)
                    formatter: function(value, context) {
                        return value; // Menampilkan nilai data
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
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Konfigurasi datalabels
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
        if (customer.STATUS && customer.STATUS.toUpperCase() === 'TERMINATED' && 
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

        if (customer.STATUS && customer.STATUS.toUpperCase() === 'TERMINATED' && 
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
    document.getElementById('mainDashboardView').style.display = 'none';
    document.getElementById('branchDetailView').style.display = 'block';
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
    populateYearMonthFilters('salesCodeYearFilter', 'salesCodeMonthFilter', currentBranchData);
    populateYearMonthFilters('bundleNameYearFilter', 'bundleNameMonthFilter', currentBranchData);
    populateYearMonthFilters('modemStatusYearFilter', 'modemStatusMonthFilter', currentBranchData); // Populate for Modem Status
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
    document.getElementById('branchCustomerListSection').style.display = 'none';
    document.getElementById('branchSalesCodeStatusSection').style.display = 'none';
    document.getElementById('branchBundleNameAnalysisSection').style.display = 'none';
    document.getElementById('branchModemStatusAnalysisSection').style.display = 'none'; // Hide new section
    document.getElementById('branchNetSubscribersAnalysisSection').style.display = 'none'; // Hide new section
    document.getElementById('branchDailyNewSubscribersSection').style.display = 'none'; // Hide new section
    document.getElementById('branchDailyTerminationSubscribersSection').style.display = 'none'; // Hide new section


    // Deactivate all sub-navigation buttons
    document.querySelectorAll('.sub-nav-buttons button').forEach(btn => btn.classList.remove('active'));

    // Show the selected section and activate its button
    if (sectionType === 'customerList') {
        document.getElementById('branchCustomerListSection').style.display = 'block';
        document.getElementById('showCustomerListBtn').classList.add('active');
        displayBranchCustomers(filteredBranchCustomerData); // Re-display in case of page change
    } else if (sectionType === 'salesCodeStatus') {
        document.getElementById('branchSalesCodeStatusSection').style.display = 'block';
        document.getElementById('showSalesCodeStatusBtn').classList.add('active');
        populateBranchSalesCodeStatusTable(currentBranchData); // Re-render with current filters
    } else if (sectionType === 'bundleNameAnalysis') {
        document.getElementById('branchBundleNameAnalysisSection').style.display = 'block';
        document.getElementById('showBundleNameAnalysisBtn').classList.add('active');
        renderBranchBundleNameChart(currentBranchData); // Re-render with current filters
    } else if (sectionType === 'modemStatusAnalysis') { // New section
        document.getElementById('branchModemStatusAnalysisSection').style.display = 'block';
        document.getElementById('showModemStatusAnalysisBtn').classList.add('active');
        renderBranchModemStatusChart(currentBranchData);
    } else if (sectionType === 'netSubscribersAnalysis') { // New section
        document.getElementById('branchNetSubscribersAnalysisSection').style.display = 'block';
        document.getElementById('showNetSubscribersAnalysisBtn').classList.add('active');
        renderBranchNetSubscribersChart(currentBranchData);
        // The table population for Net Subscribers is now handled inside renderBranchNetSubscribersChart
        // populateNetSubscribersDetailTable(currentBranchData); // This line is no longer needed here
    } else if (sectionType === 'dailyNewSubscribers') { // New section
        document.getElementById('branchDailyNewSubscribersSection').style.display = 'block';
        document.getElementById('showDailyNewSubscribersBtn').classList.add('active');
        renderBranchDailyNewSubscribersChart(currentBranchData);
    } else if (sectionType === 'dailyTerminationSubscribers') { // New section
        document.getElementById('branchDailyTerminationSubscribersSection').style.display = 'block';
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

    // Clear existing options
    statusFilter.innerHTML = '<option value="">All Statuses</option>';
    salesCodeFilter.innerHTML = '<option value="">All Sales Codes</option>';

    // Get unique statuses and sales codes from the current branch data
    const statuses = [...new Set(data.map(c => c.STATUS).filter(Boolean))].sort();
    // Ensure SALESCODE is used here
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
                              (customer.BUSINESSPARTNERID && customer.BUSINESSPARTNERID.toLowerCase().includes(searchInput)) ||
                              customerPhone.includes(searchInput) || 
                              customerAddress.includes(searchInput);
        
        const matchesStatus = statusFilter ? (customer.STATUS && customer.STATUS === statusFilter) : true;
        const matchesSalesCode = salesCodeFilter ? (customer.SALESCODE && String(customer.SALESCODE) === salesCodeFilter) : true;

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

    if (paginatedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Tidak ada data pelanggan yang cocok dengan filter.</td></tr>';
        return;
    }

    paginatedData.forEach(customer => {
        const row = tableBody.insertRow();
        row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
        row.insertCell().textContent = customer.BP_FULLNAME || '-';
        row.insertCell().textContent = customer.BP_EMAIL || '-'; // Changed from customer.EMAIL to customer.BP_EMAIL
        row.insertCell().textContent = customer.BP_PHONE ? String(customer.BP_PHONE).replace(/,(\d+)$/, '.$1') : '-';
        row.insertCell().textContent = customer.SALESCODE || '-';
        row.insertCell().textContent = customer.CONTRACTACCOUNT || '-';
        
        // Combine multiple address fields into one for display
        const fullAddress = [
            customer.INSTALLATION_ADDRESS1,
            customer.INSTALLATION_ADDRESS2,
            customer.INSTALLATION_ADDRESS3,
            customer.INSTALLATION_ADDRESS4
        ].filter(Boolean).join(', '); // Filter(Boolean) removes null/undefined/empty strings
        row.insertCell().textContent = fullAddress || '-'; // Display combined address
        
        row.insertCell().textContent = customer.STATUS || '-';
        
        // Logic for Modem Status
        let modemStatus = customer.MODEM_STATUS || '-';
        if (customer.PROMO_CODE && (customer.PROMO_CODE.toUpperCase() === 'MODEMPROMO25' || customer.PROMO_CODE.toUpperCase() === 'MODEMWIFIPROMO')) {
            modemStatus = 'modem Second/dipinjamkan';
        }
        row.insertCell().textContent = modemStatus;
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
 * Populates the "Customer Status per Sales Code" table for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function populateBranchSalesCodeStatusTable(data) {
    const tableBody = document.querySelector('#branchSalesCodeStatusTable tbody');
    if (!tableBody) {
        console.warn('Branch Sales Code Status table body not found.');
        return;
    }
    tableBody.innerHTML = '';

    const selectedYear = document.getElementById('salesCodeYearFilter')?.value;
    const selectedMonth = document.getElementById('salesCodeMonthFilter')?.value;

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE; // Assuming status is tied to contract start date
            if (!contractDate) return false;

            const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
            // Month is 0-indexed in Date object, but 1-12 for select option values
            const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString() === selectedMonth : true;
            return yearMatch && monthMatch;
        });
    }

    const salesCodeMap = {};
    filteredData.forEach(customer => {
        const salesCode = customer.SALESCODE || 'Unknown';
        const status = customer.STATUS ? customer.STATUS.toUpperCase() : 'UNKNOWN';

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
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data Sales Code untuk cabang ini dengan filter yang dipilih.</td></tr>';
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
 * Renders the "Analisis Customer per Tipe Bundle Name" chart for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchBundleNameChart(data) {
    const selectedYear = document.getElementById('bundleNameYearFilter')?.value;
    const selectedMonth = document.getElementById('bundleNameMonthFilter')?.value;

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE; // Assuming bundle name is tied to contract start date
            if (!contractDate) return false;

            const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
            const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString() === selectedMonth : true;
            return yearMatch && monthMatch;
        });
    }

    const bundleNameCounts = {};
    filteredData.forEach(c => {
        const bundleName = c.BUNDLE_NAME || 'Unknown';
        bundleNameCounts[bundleName] = (bundleNameCounts[bundleName] || 0) + 1;
    });

    const sortedBundleNames = Object.entries(bundleNameCounts)
        .sort(([,a], [,b]) => b - a);

    const labels = sortedBundleNames.map(item => item[0]);
    const chartData = sortedBundleNames.map(item => item[1]);

    const ctx = document.getElementById('branchBundleNameChart');
    if (!ctx) {
        console.warn('Canvas for branchBundleNameChart not found.');
        return;
    }
    const chartCtx = ctx.getContext('2d');

    // Destroy existing chart instance if it exists
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
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                title: {
                    display: false
                },
                datalabels: { // Konfigurasi datalabels
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
}

/**
 * Renders the "Analisis Customer per Status Modem" chart for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchModemStatusChart(data) {
    const selectedYear = document.getElementById('modemStatusYearFilter')?.value;
    const selectedMonth = document.getElementById('modemStatusMonthFilter')?.value;

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE; // Assuming modem status is tied to contract start date
            if (!contractDate) return false;

            const yearMatch = selectedYear ? contractDate.getFullYear().toString() === selectedYear : true;
            const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString() === selectedMonth : true;
            return yearMatch && monthMatch;
        });
    }

    const modemStatusCounts = {};
    filteredData.forEach(c => {
        let status = c.MODEM_STATUS || 'TIDAK DIKETAHUI';
        // Apply special logic for promo codes
        if (c.PROMO_CODE && (c.PROMO_CODE.toUpperCase() === 'MODEMPROMO25' || c.PROMO_CODE.toUpperCase() === 'MODEMWIFIPROMO')) {
            status = 'MODEM DIPINJAMKAN';
        }
        modemStatusCounts[status] = (modemStatusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(modemStatusCounts);
    const chartData = Object.values(modemStatusCounts);

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
            maintainAspectRatio: false,
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
}

/**
 * Renders the "Analisis Net Subscribers per Bulan (Customer Baru, Suspend & Terminated)" chart for the current branch.
 * @param {Array<Object>} data - The data for the current branch.
 */
function renderBranchNetSubscribersChart(data) {
    const selectedYear = document.getElementById('netSubscribersYearFilter')?.value;
    const selectedMonth = document.getElementById('netSubscribersMonthFilter')?.value;

    let filteredData = data;
    if (selectedYear || selectedMonth) {
        filteredData = data.filter(customer => {
            const contractDate = customer.CONTRACTSTARTDATE;
            const termDate = customer.TERMDATE;

            let dateToCheck = null;
            // Prioritize termDate for terminated customers, otherwise use contractDate
            if (customer.STATUS && customer.STATUS.toUpperCase() === 'TERMINATED' && termDate instanceof Date) {
                dateToCheck = termDate;
            } else if (contractDate instanceof Date) {
                dateToCheck = contractDate;
            }

            if (!dateToCheck) return false;

            const yearMatch = selectedYear ? dateToCheck.getFullYear().toString() === selectedYear : true;
            const monthMatch = selectedMonth ? (dateToCheck.getMonth() + 1).toString() === selectedMonth : true;
            return yearMatch && monthMatch;
        });
    }

    const monthlyData = {}; // { 'YYYY-MM': { new: 0, suspended: 0, terminated: 0, net: 0 } }

    filteredData.forEach(c => {
        let monthKeyForNew = null;
        let monthKeyForTerminated = null;
        let monthKeyForSuspended = null;

        if (c.CONTRACTSTARTDATE instanceof Date) {
            monthKeyForNew = `${c.CONTRACTSTARTDATE.getFullYear()}-${(c.CONTRACTSTARTDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        if (c.TERMDATE instanceof Date && c.STATUS && c.STATUS.toUpperCase() === 'TERMINATED') {
            monthKeyForTerminated = `${c.TERMDATE.getFullYear()}-${(c.TERMDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }
        // Assuming suspended status is also tied to contract start date for monthly aggregation
        if (c.STATUS && c.STATUS.toUpperCase() === 'SUSPENDED' && c.CONTRACTSTARTDATE instanceof Date) {
            monthKeyForSuspended = `${c.CONTRACTSTARTDATE.getFullYear()}-${(c.CONTRACTSTARTDATE.getMonth() + 1).toString().padStart(2, '0')}`;
        }

        // Collect all unique month keys involved in this customer's lifecycle
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


    const sortedMonths = Object.keys(monthlyData).sort();

    const newCustomersData = sortedMonths.map(month => monthlyData[month].new);
    const suspendedData = sortedMonths.map(month => monthlyData[month].suspended);
    const terminatedData = sortedMonths.map(month => monthlyData[month].terminated);
    const netSubsData = sortedMonths.map(month => monthlyData[month].net);

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
            labels: sortedMonths,
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
            maintainAspectRatio: false,
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
    populateNetSubscribersDetailTable(monthlyData, sortedMonths, selectedYear, selectedMonth);
}

/**
 * Populates the table for Net Subscribers data.
 * @param {Object} monthlyData - The aggregated data for each month.
 * @param {Array<string>} sortedMonths - Sorted list of month keys.
 * @param {string} selectedYear - The currently selected year from the filter.
 * @param {string} selectedMonth - The currently selected month from the filter.
 */
function populateNetSubscribersDetailTable(monthlyData, sortedMonths, selectedYear, selectedMonth) {
    const tableBody = document.querySelector('#netSubscribersDetailTable tbody');
    if (!tableBody) {
        console.warn('Net Subscribers Detail table body not found.');
        return;
    }
    tableBody.innerHTML = ''; // Clear existing rows

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
                        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    let dataToDisplay = [];

    if (selectedYear && selectedMonth) {
        // If both year and month are selected, show only that specific month
        const targetMonthKey = `${selectedYear}-${selectedMonth.padStart(2, '0')}`;
        if (monthlyData[targetMonthKey]) {
            dataToDisplay.push({ monthKey: targetMonthKey, data: monthlyData[targetMonthKey] });
        }
    } else if (selectedYear) {
        // If only year is selected, show all months for that year
        dataToDisplay = sortedMonths
            .filter(monthKey => monthKey.startsWith(selectedYear))
            .map(monthKey => ({ monthKey: monthKey, data: monthlyData[monthKey] }));
    } else {
        // If no filters or only month is selected (which defaults to all years for that month), show all data
        dataToDisplay = sortedMonths.map(monthKey => ({ monthKey: monthKey, data: monthlyData[monthKey] }));
    }

    if (dataToDisplay.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data Net Subscribers untuk filter yang dipilih.</td></tr>';
        return;
    }

    dataToDisplay.forEach(item => {
        const year = item.monthKey.split('-')[0];
        const monthNum = parseInt(item.monthKey.split('-')[1]);
        const monthName = monthNames[monthNum - 1];

        const row = tableBody.insertRow();
        row.insertCell().textContent = `${monthName} ${year}`;
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
        const monthMatch = selectedMonth ? (contractDate.getMonth() + 1).toString() === selectedMonth : true;
        
        return yearMatch && monthMatch;
    });

    const dailyNewSubscribers = filteredData.filter(c => 
        c.CONTRACTSTARTDATE && c.CONTRACTSTARTDATE instanceof Date
    );
    console.log(`Total dailyNewSubscribers after year/month filter: ${dailyNewSubscribers.length}`);


    const dailyCounts = {}; // { 'YYYY-MM-DD': count }
    dailyNewSubscribers.forEach(c => {
        // Normalisasi CONTRACTSTARTDATE ke awal hari untuk kunci
        const normalizedDate = new Date(c.CONTRACTSTARTDATE);
        normalizedDate.setHours(0, 0, 0, 0);
        // Menggunakan toLocaleDateString('en-CA') untuk format YYYY-MM-DD
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
        // Kunci untuk mencari data di dailyCounts harus sesuai dengan format toLocaleDateString('en-CA')
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
            maintainAspectRatio: false,
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
            // If no bar is clicked, clear the table
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
    // Menggunakan waktu lokal untuk mencocokkan data dan ekspektasi pengguna
    const targetDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, clickedDay);
    targetDate.setHours(0, 0, 0, 0); // Normalisasi tanggal target ke awal hari
    // Menggunakan toLocaleDateString('en-CA') untuk format YYYY-MM-DD yang konsisten
    const targetDateString = targetDate.toLocaleDateString('en-CA');
    console.log(`displayDailyNewSubscribersDetail: Target Date String for filter: ${targetDateString}`); 

    const customersForClickedDay = dailyNewSubscribersData.filter(customer => {
        if (!customer.CONTRACTSTARTDATE) {
            console.log('Skipping customer due to missing CONTRACTSTARTDATE');
            return false;
        }
        // Normalisasi tanggal pelanggan ke awal hari dan dapatkan string YYYY-MM-DD
        const customerDate = new Date(customer.CONTRACTSTARTDATE);
        customerDate.setHours(0, 0, 0, 0); 
        const customerDateString = customerDate.toLocaleDateString('en-CA');
        
        console.log(`Comparing Customer Date String: ${customerDateString} with Target Date String: ${targetDateString}. Match: ${customerDateString === targetDateString}`);
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
        const monthMatch = selectedMonth ? (termDate && (termDate.getMonth() + 1).toString() === selectedMonth) || (expiredDate && (expiredDate.getMonth() + 1).toString() === selectedMonth) : true;
        
        return yearMatch && monthMatch;
    });

    const dailyTerminationCounts = {}; // { 'YYYY-MM-DD': count }
    const dailyForecastCounts = {}; // { 'YYYY-MM-DD': count }

    filteredData.forEach(c => {
        // Actual terminations
        if (c.STATUS && c.STATUS.toUpperCase() === 'TERMINATED' && c.TERMDATE instanceof Date) {
            const normalizedDate = new Date(c.TERMDATE);
            normalizedDate.setHours(0, 0, 0, 0);
            const dateKey = normalizedDate.toLocaleDateString('en-CA');
            dailyTerminationCounts[dateKey] = (dailyTerminationCounts[dateKey] || 0) + 1;
        }
        // Forecast terminations (based on EXPIREDDATE for non-terminated active/suspended customers)
        else if (c.EXPIREDDATE instanceof Date && c.STATUS && (c.STATUS.toUpperCase() === 'ACTIVE' || c.STATUS.toUpperCase() === 'SUSPENDED')) {
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
            maintainAspectRatio: false,
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
    console.log(`displayDailyTerminationSubscribersDetail: Target Date String for filter: ${targetDateString}`);

    const customersForClickedDay = allFilteredData.filter(customer => {
        let customerDate = null;
        let isTermination = false;
        let isForecast = false;

        if (customer.STATUS && customer.STATUS.toUpperCase() === 'TERMINATED' && customer.TERMDATE instanceof Date) {
            customerDate = new Date(customer.TERMDATE);
            isTermination = true;
        } else if (customer.EXPIREDDATE instanceof Date && (customer.STATUS.toUpperCase() === 'ACTIVE' || customer.STATUS.toUpperCase() === 'SUSPENDED')) {
            customerDate = new Date(customer.EXPIREDDATE);
            isForecast = true;
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
 */
function populateYearMonthFilters(yearSelectId, monthSelectId, data) {
    const yearSelect = document.getElementById(yearSelectId);
    const monthSelect = document.getElementById(monthSelectId);

    if (!yearSelect || !monthSelect) {
        console.warn(`Year/Month filter elements with IDs ${yearSelectId} atau ${monthSelectId} tidak ditemukan.`);
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
        // Use CONTRACTSTARTDATE for year/month filtering as it's common for new registrations/status changes
        if (customer.CONTRACTSTARTDATE instanceof Date) {
            years.add(customer.CONTRACTSTARTDATE.getFullYear());
            months.add(customer.CONTRACTSTARTDATE.getMonth() + 1); // Month is 0-indexed, so add 1
        }
        // Also consider TERMDATE for Net Subscribers analysis and Termination analysis
        if (customer.TERMDATE instanceof Date) {
            years.add(customer.TERMDATE.getFullYear());
            months.add(customer.TERMDATE.getMonth() + 1);
        }
        // Also consider EXPIREDDATE for Termination Forecast
        if (customer.EXPIREDDATE instanceof Date) {
            years.add(customer.EXPIREDDATE.getFullYear());
            months.add(customer.EXPIREDDATE.getMonth() + 1);
        }
    });

    [...years].sort((a, b) => b - a).forEach(year => { // Sort descending for years
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    [...months].sort((a, b) => a - b).forEach(monthNum => { // Sort ascending for months
        const option = document.createElement('option');
        option.value = monthNum;
        option.textContent = monthNames[monthNum - 1]; // Adjust for 0-indexed array
        monthSelect.appendChild(option);
    });

    // Reapply previous selections if they still exist in the new options
    if (currentSelectedYear && [...years].includes(parseInt(currentSelectedYear))) {
        yearSelect.value = currentSelectedYear;
    }
    if (currentSelectedMonth && [...months].includes(parseInt(currentSelectedMonth))) {
        monthSelect.value = currentSelectedMonth;
    }
}

/**
 * Displays an inline section with a list of terminated customers for a specific branch.
 * @param {string} branchName - The name of the branch.
 */
function displayInlineTerminatedCustomers(branchName) {
    const inlineSection = document.getElementById('inlineTerminatedCustomersSection');
    const sectionTitle = document.getElementById('inlineTerminatedCustomersTitle');
    const tableBody = document.querySelector('#inlineTerminatedCustomersTable tbody');

    if (!inlineSection || !sectionTitle || !tableBody) {
        console.error('Inline terminated customers section elements not found.');
        return;
    }

    sectionTitle.textContent = `Terminated Customers for ${branchName}`;
    tableBody.innerHTML = ''; // Clear previous data

    const today = latestAvailableDataDate ? new Date(latestAvailableDataDate) : new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const terminatedCustomers = allCustomerData.filter(customer => 
        customer.BRANCH_FROM_SALESCODE === branchName &&
        customer.STATUS && customer.STATUS.toUpperCase() === 'TERMINATED' &&
        customer.TERMDATE && customer.TERMDATE instanceof Date &&
        customer.TERMDATE >= startOfMonth && customer.TERMDATE <= today
    );

    if (terminatedCustomers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Tidak ada pelanggan TERMINATED untuk cabang ini di bulan ini.</td></tr>';
    } else {
        terminatedCustomers.forEach(customer => {
            const row = tableBody.insertRow();
            row.insertCell().textContent = customer.BP_FULLNAME || '-';
            row.insertCell().textContent = customer.BUSINESSPARTNERID || '-';
            row.insertCell().textContent = customer.BP_PHONE ? String(customer.BP_PHONE).replace(/,(\d+)$/, '.$1') : '-'; 
            row.insertCell().textContent = customer.TERMDATE ? customer.TERMDATE.toLocaleDateString('id-ID') : '-';
        });
    }

    inlineSection.classList.remove('hidden');
    inlineSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); // Scroll to the new section
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

// Helper function to render charts (reused from previous versions)
function renderChart(chartId, type, labels, data, chartTitle) {
    const ctx = document.getElementById(chartId);
    if (!ctx) {
        console.warn(`Canvas element with ID '${chartId}' not found.`);
        return;
    }
    const chartCtx = ctx.getContext('2d');
    
    const backgroundColors = [
        'rgba(0, 123, 255, 0.7)', // Biznet Blue
        'rgba(40, 167, 69, 0.7)',  // Green (Success)
        'rgba(255, 193, 7, 0.7)',  // Yellow (Warning)
        'rgba(220, 53, 69, 0.7)',  // Red (Danger)
        'rgba(108, 117, 125, 0.7)', // Grey
        'rgba(23, 162, 184, 0.7)', // Cyan
        'rgba(102, 16, 242, 0.7)', // Indigo
        'rgba(111, 66, 193, 0.7)', // Purple
        'rgba(232, 62, 140, 0.7)', // Pink
        'rgba(253, 126, 20, 0.7)'  // Orange
    ];
    const borderColors = [
        'rgba(0, 123, 255, 1)',
        'rgba(40, 167, 69, 1)',
        'rgba(255, 193, 7, 1)',
        'rgba(220, 53, 69, 1)',
        'rgba(108, 117, 125, 1)',
        'rgba(23, 162, 184, 1)',
        'rgba(102, 16, 242, 1)',
        'rgba(111, 66, 193, 1)',
        'rgba(232, 62, 140, 1)',
        'rgba(253, 126, 20, 1)'
    ];

    const chartConfig = {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: chartTitle,
                data: data,
                backgroundColor: type === 'line' ? 'rgba(0, 123, 255, 0.2)' : backgroundColors.slice(0, labels.length),
                borderColor: type === 'line' ? 'rgba(0, 123, 255, 1)' : borderColors.slice(0, labels.length),
                borderWidth: 1,
                fill: type === 'line' ? true : false,
                tension: type === 'line' ? 0.4 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: type === 'doughnut' ? 'right' : 'top',
                    labels: {
                        font: {
                            size: 10
                        }
                    }
                },
                title: {
                    display: false
                },
                datalabels: { // Konfigurasi datalabels untuk helper function
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
            scales: type === 'bar' || type === 'line' ? {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { if (value % 1 === 0) return value; },
                        font: {
                            size: 10
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            } : {}
        }
    };

    // Destroy existing chart instance before creating a new one to prevent duplication
    if (chartId === 'top5NewDemandChart' && top5NewDemandChart) top5NewDemandChart.destroy();
    if (chartId === 'mtdRegistrationStatusChart' && mtdRegistrationStatusChart) mtdRegistrationStatusChart.destroy();
    if (chartId === 'branchBundleNameChart' && branchBundleNameChart) branchBundleNameChart.destroy();
    if (chartId === 'branchModemStatusChart' && branchModemStatusChart) branchModemStatusChart.destroy(); // Destroy new chart
    if (chartId === 'branchNetSubscribersChart' && branchNetSubscribersChart) branchNetSubscribersChart.destroy(); // Destroy new chart
    if (chartId === 'branchDailyNewSubscribersChart' && branchDailyNewSubscribersChart) branchDailyNewSubscribersChart.destroy(); // Destroy new chart
    if (chartId === 'branchDailyTerminationChart' && branchDailyTerminationChart) branchDailyTerminationChart.destroy(); // Destroy new chart


    // Create a new chart instance and save it to the global variable
    if (chartId === 'top5NewDemandChart') top5NewDemandChart = new Chart(chartCtx, chartConfig);
    else if (chartId === 'mtdRegistrationStatusChart') mtdRegistrationStatusChart = new Chart(chartCtx, chartConfig);
    else if (chartId === 'branchBundleNameChart') branchBundleNameChart = new Chart(chartCtx, chartConfig);
    else if (chartId === 'branchModemStatusChart') branchModemStatusChart = new Chart(chartCtx, chartConfig); // Create new chart
    else if (chartId === 'branchNetSubscribersChart') branchNetSubscribersChart = new Chart(chartCtx, chartConfig); // Create new chart
    else if (chartId === 'branchDailyNewSubscribersChart') branchDailyNewSubscribersChart = new Chart(chartCtx, chartConfig); // Create new chart
    else if (chartId === 'branchDailyTerminationChart') branchDailyTerminationChart = new Chart(chartCtx, chartConfig); // Create new chart
}

// Placeholder functions (not used in this version, but kept for future expansion if needed)
function updateProductPerformance() { console.log('updateProductPerformance (not used in this view)'); }
function updateTerminationAnalysis() { console.log('updateTerminationAnalysis (not used in this view)'); }
function updateMainCharts() { console.log('updateMainCharts (not used in this view, replaced by specific renders)'); }
function displayCustomers() { console.log('displayCustomers (not used in this view)'); }
function changePage() { console.log('changePage (not used in this view)'); }
