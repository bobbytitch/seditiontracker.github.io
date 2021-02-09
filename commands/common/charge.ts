import XLSX = require('xlsx')

export interface Charge {
  code: string
  name: string
  link: string
}

export interface ChargeEntry {
  name: string,
  charges: Charge[],
  military: string,
  police: string,
  dojNumber: string
}

export const getChargeData = (filename) => {
  const workbook = XLSX.readFile(filename)
  return workbook.Sheets["Arrested"]
}

export const fixCode = (code) => {
  switch(code) {
    case "0 USC 5104(e)(2)(C)(D) and (G)":
      return "40 USC 5104(e)(2)(C)(D) and (G)"
    default:
      return code
  }
}
