#!/usr/bin/env node
const http = require('http')
const fs = require('fs')
const url = require('url')
const path = require('path')

const args = process.argv.slice(2)
let file = null
let port = 8080
for(let i=0;i<args.length;i++){
  const a = args[i]
  if(a === '--file') file = args[i+1]
  if(a === '--port') port = parseInt(args[i+1]||'8080',10)
}
if(!file){
  console.error('Usage: serve-report --file <json> [--port 8080]')
  process.exit(1)
}
const summary = JSON.parse(fs.readFileSync(file,'utf8'))

function h(s){ return String(s||'') }
function html(){
  const total = h(summary.totalSavedMB)
  const compRows = (summary.compressed||[]).map(i=>`<tr><td>${i.file}</td><td>${i.beforeMB} MB</td><td>${i.afterMB} MB</td><td>${i.savedMB} MB</td></tr>`).join('')
  const webpRows = (summary.webpGenerated||[]).map(p=>`<li>${p}</li>`).join('')
  const codeRows = (summary.codeModified||[]).map(p=>`<li>${p}</li>`).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>img-optimize report</title>
  <style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}th{background:#f7f7f7;text-align:left}</style>
  </head><body>
  <h1>img-optimize Report</h1>
  <p><b>action:</b> ${h(summary.action)} | <b>mode:</b> ${h(summary.mode)} | <b>dry:</b> ${h(summary.dry)}</p>
  <p><b>Total Saved:</b> ${total} MB</p>
  <h2>Compressed Files</h2>
  <table><thead><tr><th>File</th><th>Before</th><th>After</th><th>Saved</th></tr></thead><tbody>${compRows || ''}</tbody></table>
  <h2>Generated WebP</h2>
  <ul>${webpRows || ''}</ul>
  <h2>Modified Code</h2>
  <ul>${codeRows || ''}</ul>
  </body></html>`
}

const srv = http.createServer((req,res)=>{
  const u = url.parse(req.url)
  if(u.pathname === '/' || u.pathname === '/index.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'})
    res.end(html())
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})
srv.listen(port, ()=>{
  const link = `http://localhost:${port}/`
  console.log(link)
})

