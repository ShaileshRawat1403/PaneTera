import { getBaseContract, isVisible, createEvidenceItem } from './utils.js';

export function extractTables() {
  const contract = getBaseContract("browser.table.extract");
  const tables = Array.from(document.querySelectorAll('table'));
  
  const data = [];
  
  tables.forEach((table, tableIndex) => {
    if (!isVisible(table)) return;
    
    const extractedTable = {
      id: table.id || `table-${tableIndex}`,
      headers: [],
      rows: []
    };
    
    // Naive header extraction
    const thead = table.querySelector('thead');
    let headerCells = [];
    if (thead) {
      headerCells = Array.from(thead.querySelectorAll('th, td'));
    } else {
      const firstRow = table.querySelector('tr');
      if (firstRow && firstRow.querySelector('th')) {
        headerCells = Array.from(firstRow.querySelectorAll('th'));
      }
    }
    
    extractedTable.headers = headerCells.map(th => th.textContent.trim());
    
    // Body extraction
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(tr => {
      if (!isVisible(tr)) return false;
      // Skip the header row if we identified it in the body
      if (tr.querySelector('th') && !thead) return false; 
      return true;
    });
    
    rows.forEach((tr, rowIndex) => {
      const rowData = [];
      const cells = Array.from(tr.querySelectorAll('td, th'));
      
      cells.forEach((cell, colIndex) => {
        const text = cell.textContent.trim();
        const item = createEvidenceItem('table-cell', 'table.visible.v1', null, undefined, rowIndex, colIndex);
        
        contract.evidence.items.push(item);
        contract.evidence.elementsMatched++;
        contract.evidence.contentBytes += new Blob([text]).size;
        
        rowData.push({
          evidenceId: item.evidenceId,
          text: text
        });
      });
      extractedTable.rows.push(rowData);
    });
    
    data.push(extractedTable);
  });

  contract.data = { tables: data };
  return contract;
}
