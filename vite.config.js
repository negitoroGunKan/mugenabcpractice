import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// CSV Parser
function parseCSV(text) {
  const result = [];
  let row = [''];
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      result.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    result.push(row);
  }
  return result;
}

// CSV Stringifier
function stringifyCSV(rows) {
  return rows.map(row => {
    return row.map(cell => {
      let val = String(cell);
      let needsQuoting = false;
      if (val.includes(',') || val.includes('\n') || val.includes('\r') || val.includes('"')) {
        needsQuoting = true;
        val = val.replace(/"/g, '""');
      }
      return needsQuoting ? `"${val}"` : val;
    }).join(',');
  }).join('\r\n') + '\r\n';
}

const csvUpdatePlugin = () => ({
  name: 'csv-update-plugin',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.method === 'POST' && req.url === '/api/update-question') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const { id, question, answer, reading, tags, explanation } = data;
            
            if (!id) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing question ID' }));
              return;
            }

            const csvPath = path.resolve(__dirname, 'public/data.csv');
            if (!fs.existsSync(csvPath)) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'data.csv not found' }));
              return;
            }

            const fileContent = fs.readFileSync(csvPath, 'utf8');
            const rows = parseCSV(fileContent);
            
            // ヘッダーにタグ列がなければ追加
            if (rows[0].length <= 6) {
              rows[0][6] = 'タグ';
            }
            
            let found = false;
            let validCount = 0;
            for (let i = 0; i < rows.length; i++) {
              const row = rows[i];
              if (row.length >= 4 && row[2] && row[3]) {
                validCount++;
                if (String(validCount) === String(id)) {
                  row[2] = question; // 問題
                  row[3] = answer;   // 解答
                  row[0] = tags || ''; // タグ (1列目)
                  row[4] = explanation || ''; // 解説 (5列目)
                  found = true;
                  break;
                }
              }
            }

            if (!found) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Question ID not found in CSV' }));
              return;
            }

            const updatedContent = stringifyCSV(rows);
            fs.writeFileSync(csvPath, updatedContent, 'utf8');
            
            console.log(`[CSV Update] Successfully updated question ID ${id}`);
            
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            console.error('[CSV Update Error]', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), csvUpdatePlugin()],
  server: {
    host: true,
    open: true
  },
  build: {
    minify: false,
    emptyOutDir: true
  }
})
