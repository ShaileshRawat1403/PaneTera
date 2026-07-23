// chrome-extension/src/extractors/table.js
import { appendEvidenceRecord, getBaseContract, isVisible, createEvidenceItem, extractSafeText, redactExtractionText } from './utils.js';

export function extractTables() {
  const contract = getBaseContract("browser.table.extract");
  const tables = Array.from(document.querySelectorAll('table'));
  
  const data = [];
  let totalRedactions = 0;
  
  for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
    const table = tables[tableIndex];
    if (!isVisible(table)) continue;
    
    const extractedTable = {
      id: table.id || `table-${tableIndex}`,
      headers: [],
      rows: []
    };
    
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
    
    for (let headerIndex = 0; headerIndex < headerCells.length; headerIndex++) {
      const cell = headerCells[headerIndex];
      const { safeText, redactionCount } = extractSafeText(cell);
      const { redactedText, redactions } = redactExtractionText(safeText, contract);
      totalRedactions += redactionCount + redactions.credentials + redactions.emails + redactions.creditCards;
      const item = createEvidenceItem('table-cell', 'table.header.v1', null, undefined, -1, headerIndex);
      const appended = appendEvidenceRecord(contract, item, redactedText, extractedTable.headers, {
        evidenceId: item.evidenceId,
        text: redactedText
      }, 'Table header collection stopped at the evidence limit.');
      if (!appended) break;
    }
    
    const rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(tr => {
      if (!isVisible(tr)) return false;
      if (tr.closest('thead')) return false;
      if (tr.querySelector('th') && !thead) return false; 
      return true;
    });
    
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const tr = rows[rowIndex];
      const rowData = [];
      const cells = Array.from(tr.querySelectorAll('td, th'));

      let rowWasTruncated = false;
      for (let colIndex = 0; colIndex < cells.length; colIndex++) {
        const cell = cells[colIndex];
        const { safeText, redactionCount } = extractSafeText(cell);
        const { redactedText, redactions } = redactExtractionText(safeText, contract);
        totalRedactions += redactionCount + redactions.credentials + redactions.emails + redactions.creditCards;

        const item = createEvidenceItem('table-cell', 'table.visible.v1', null, undefined, rowIndex, colIndex);
        
        const appended = appendEvidenceRecord(contract, item, redactedText, rowData, {
          evidenceId: item.evidenceId,
          text: redactedText
        }, 'Table cell collection stopped at the evidence limit.');
        if (!appended) {
          rowWasTruncated = true;
          break;
        }
      }
      if (rowData.length > 0) extractedTable.rows.push(rowData);
      if (rowWasTruncated) break;
    }
    
    data.push(extractedTable);
    if (contract.truncated) break;
  }

  if (totalRedactions > 0) {
    contract.warnings.push(`Redacted ${totalRedactions} form values/secrets from extracted table cells.`);
  }

  contract.data = { tables: data };
  return contract;
}
