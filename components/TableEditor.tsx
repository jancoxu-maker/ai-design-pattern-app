import React, { useState, useEffect } from 'react';

interface TableEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
}

const TableEditor: React.FC<TableEditorProps> = ({ markdown, onChange }) => {
  const [rows, setRows] = useState<string[][]>([]);

  useEffect(() => {
    const lines = markdown.split('\n').filter(line => line.trim() !== '');
    const tableRows = lines
      .filter(line => line.includes('|'))
      .map(line => line.split('|').map(cell => cell.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1));
    
    // Remove header separator row
    const dataRows = tableRows.filter(row => !row.every(cell => cell.includes('-')));
    setRows(dataRows);
  }, [markdown]);

  const updateTable = (newRows: string[][]) => {
    setRows(newRows);
    const header = '| ' + newRows[0].map(() => 'Header').join(' | ') + ' |';
    const separator = '| ' + newRows[0].map(() => '---').join(' | ') + ' |';
    const body = newRows.map(row => '| ' + row.join(' | ') + ' |').join('\n');
    onChange(`${header}\n${separator}\n${body}`);
  };

  return (
    <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
      <h4 className="text-sm font-bold mb-2">表格编辑器</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-1">
                    <input
                      className="w-full p-1 border border-zinc-300 rounded"
                      value={cell}
                      onChange={(e) => {
                        const newRows = [...rows];
                        newRows[rowIndex][cellIndex] = e.target.value;
                        updateTable(newRows);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button 
        className="mt-2 text-xs text-brand-600 font-bold"
        onClick={() => updateTable([...rows, new Array(rows[0].length).fill('')])}
      >
        + 添加行
      </button>
    </div>
  );
};

export default TableEditor;
