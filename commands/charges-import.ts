import { Command } from "commander";
import { writeFile } from "./common/file"
import { info, warning } from "./common/console";
import { ChargeEntry, getChargeData } from "./common/charge"
import { getSuspectByFile, updateSuspect } from "./common/suspect"
import { isEmpty, update } from "lodash"
import { convertDojName, getSuspect } from "./common/suspect";

const cmd = new Command().requiredOption("-f, --file <file>", "CSV file to use for import").option("-m, --map", "Build charge map");
cmd.parse(process.argv);

const buildChargeMap = async() => {
  info("Building charge map");
  const map = {}

  for (const entry of await getCharges()) {
    for (const charge of entry.charges) {
      map[charge.code] = map[charge.code] || charge
    }
  }

  const codes = Object.keys(map).sort()

  const sortedMap = {}
  for (const code of codes) {
    sortedMap[code] = map[code]
  }

  writeFile("commands/common/chargesList.ts", `export const allCharges = ${JSON.stringify(sortedMap, null, 2)}`)
}

const importCharges = async() => {
  info("Importing list of charges");

  for (const entry of await getCharges()) {
    const filename = convertDojName(entry.name) + ".md"

    try {
      const suspect = getSuspectByFile(filename)
      if (!suspect) {
        continue
      } else {
        for (const charge of entry.charges) {
          suspect.charges[charge.code] = charge
        }
        updateSuspect(suspect)
      }
    } catch (ex) {
      warning(`Unable to load suspect with filename: ${filename}  `)
    }
  }
}

const getCharges = async() => {
  const sheet = getChargeData(cmd.file)
  const rowSet = new Set()
  const chargeEntries = []

  for (const [key, value] of Object.entries(sheet)) {
    if (key == "!ref") { continue }
    const [,col, row] = key.match(/([A-Z]*)(\d*)/)

    if (row == "1") {
      continue
    }

    rowSet.add(row)
  }

  for (const row of rowSet) {

    const entry:ChargeEntry = {
      name: sheet[`T${row}`]["v"].trim(),
      dojNumber: sheet[`U${row}`] ? sheet[`U${row}`]["v"].trim() : "",
      military: sheet[`Z${row}`] ? sheet[`Z${row}`]["v"].trim() : "",
      police: sheet[`AA${row}`] ? sheet[`AA${row}`]["v"].trim() : "",
      charges: []
    }

    if (sheet[`AB${row}`]) {
      const chargeCell = sheet[`AB${row}`]["v"]
      if (isEmpty(chargeCell)) {
        continue;
      }
      if (!/\S*,/.test(entry.name)) {
        warning(`Name is not in LASTNAME, First format: ${entry.name}`)
        continue;
      }

      const charges = chargeCell.split("\n")

      for (const charge of charges) {
        const chargesRegEx = new RegExp(/((\d*) USC ((\d*)(\(.*)?))\s(-|–|\s{1,2})(.*)/)

        if (chargesRegEx.test(charge)) {
          const [,code, title,, section,,, name] = charge.match(chargesRegEx)
          entry.charges.push({
            code: cleanCode(code),
            name: name.trim(),
            link: `https://www.law.cornell.edu/uscode/text/${title.trim()}/${section.trim()}`
          })
        } else {
          // // since the full regex did not work, try getting just the code
          // if (charge.match(/(\d* USC \d*.*)-/)) {
          //   console.log(`looking up by code: ${RegExp.$1}`)
          //   console.log(`result: ${getChargeMap()[RegExp.$1]}`)
          // }
          warning(`Unable to read charges for ${entry.name}`)
          console.log(charge)
          entry.charges = []
          break
        }
      }
    }

    if (entry.charges.length > 0) {
      chargeEntries.push(entry)
    }
  }

  return chargeEntries
}

/**
 * Data from this site entered by humans so it's not always in a
 * consistent format
 * @param code
 */
const cleanCode = (code: string) => {
  code = code.trim()
  code = code.replace(/\), \(/, ")(")
  code = code.replace(/, \(/, "(")
  code = code.replace(",", "")
  code = code.replace("18 USC 1512()(2)", "18 USC 1512(c)(2)") // Hack for Spaz until that's fixed
  return code
}

if (cmd.map) {
  buildChargeMap();
} else {
  importCharges();
}
