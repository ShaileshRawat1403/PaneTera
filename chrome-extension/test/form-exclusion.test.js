// chrome-extension/test/form-exclusion.test.js
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import { extractSafeText } from '../src/extractors/utils.js';
import { extractTables } from '../src/extractors/table.js';

console.log('Running form-exclusion tests...');

const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="testContainer">
    <label for="usr">Username:</label>
    <input type="text" id="usr" value="my_secret_username">
    <input type="password" id="pass" value="super_secret_password">
    <input type="hidden" id="csrf" value="csrf_token_value">
    <textarea id="bio">Draft bio content</textarea>
    <select id="role"><option selected>Admin</option></select>
    <div contenteditable="true">Editable draft content</div>
  </div>

  <table id="targetTable">
    <thead>
      <tr><th>Item</th><th>Input Field</th></tr>
    </thead>
    <tbody>
      <tr>
        <td>Row 1 Label</td>
        <td><input type="text" value="secret_row1_value"> Static Cell Text</td>
      </tr>
      <tr>
        <td>Row 2 Label</td>
        <td><input type="password" value="secret_pass"> Static Pass Text</td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

const dom = new JSDOM(html);
global.window = dom.window;
global.document = dom.window.document;
global.Element = dom.window.Element;

// 1. Test extractSafeText on container
const container = document.getElementById('testContainer');
const { safeText, redactionCount } = extractSafeText(container);

// Verify password and hidden input values are absent
assert.strictEqual(safeText.includes('super_secret_password'), false);
assert.strictEqual(safeText.includes('csrf_token_value'), false);
assert.strictEqual(safeText.includes('my_secret_username'), false);
assert.strictEqual(safeText.includes('Draft bio content'), false);
assert.strictEqual(safeText.includes('Editable draft content'), false);

// Verify form value redaction marker is present
assert.strictEqual(safeText.includes('[FORM_VALUE_REDACTED]'), true);
assert.strictEqual(safeText.includes('Username:'), true);
assert.ok(redactionCount >= 3);

// 2. Test table extraction structure preservation
const tableContract = extractTables();
assert.strictEqual(tableContract.data.tables.length, 1);

const table = tableContract.data.tables[0];
assert.strictEqual(table.headers.length, 2);
assert.strictEqual(table.rows.length, 2);

// Check Row 1 preserves structure and redacts input value
const row1Cell2 = table.rows[0][1].text;
assert.strictEqual(row1Cell2.includes('secret_row1_value'), false);
assert.strictEqual(row1Cell2.includes('[FORM_VALUE_REDACTED]'), true);
assert.strictEqual(row1Cell2.includes('Static Cell Text'), true);

// Check Row 2 password removal
const row2Cell2 = table.rows[1][1].text;
assert.strictEqual(row2Cell2.includes('secret_pass'), false);
assert.strictEqual(row2Cell2.includes('Static Pass Text'), true);

console.log('✅ form-exclusion tests passed.');
