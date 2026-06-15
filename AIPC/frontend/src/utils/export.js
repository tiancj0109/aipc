export const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;

    // Get all unique keys from the data array
    const keys = Array.from(new Set(data.flatMap(item => Object.keys(item))));

    // Determine CSV header
    const csvContent = [
        keys.join(','), // Header row
        ...data.map(item =>
            keys.map(key => {
                let cellData = item[key] === null || item[key] === undefined ? '' : String(item[key]);
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (cellData.includes(',') || cellData.includes('"') || cellData.includes('\n')) {
                    cellData = `"${cellData.replace(/"/g, '""')}"`;
                }
                return cellData;
            }).join(',')
        )
    ].join('\n');

    // Add BOM for Excel UTF-8 compatibility
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};
