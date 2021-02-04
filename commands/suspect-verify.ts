import { Command } from "commander";
import { exitWithError, info } from "./common/console";
import fs from "fs";
import { readFile } from "./common/file";
import { getSuspectByFile } from "./common/suspect";
const { execSync } = require('child_process')
import { isEmpty } from "lodash";

const verify = new Command()
verify.parse(process.argv);

const doVerify = () => {
  const suspects = fs.readdirSync('./docs/_suspects');

  for (const filename of suspects) {
    const suspect = getSuspectByFile(filename);

    // ignore unpublished suspects
    if (!suspect.published) {
      continue;
    }

    // if (suspect.date == "[date]" || isEmpty(suspect.date) || suspect.data.match(/title: .*\[longDate]/)) {
    //   exitWithError(`Missing date for ${suspect.name}`);
    // }

    // // look for newly indicted
    // if (suspect.status == "Charged" && /Indictment/.test(suspect.data)) {
    //   suspect.status = "Indicted"
    //   //data = data.replace("status: Charged", "status: Indicted");
    //   console.log (`Indicted: ${suspect.name}`)
    //   console.log(suspect.links)
    // }

    // const previewImage = `docs/images/preview/${suspect.image}`

    // if (fs.existsSync(previewImage)) {
    //   continue;
    // } else {
    //   // no preview found, let's try generating one
    //   info(`Generating preview for ${suspect.name}`)
    //   try {
    //     execSync(`yarn suspect preview -f ${suspect.image} -s ${suspect.status}`)
    //     execSync(`git add docs/images/preview`)
    //   } catch (error) {
    //     exitWithError(`No preview exists for ${suspect.name}`)
    //   }
    // }
  }
  return;
}

doVerify();
