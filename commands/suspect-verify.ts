import { Command } from "commander";
import { exitWithError, info } from "./common/console";
import fs from "fs";
import { readFile } from "./common/file";
const { execSync } = require('child_process')
import { isEmpty } from "lodash";

const verify = new Command()
verify.parse(process.argv);

const doVerify = () => {
  const suspects = fs.readdirSync('./docs/_suspects');

  for (const suspect of suspects) {
    const data = readFile(`./docs/_suspects/${suspect}`)

    // ignore unpublished suspects
    if (data.match(/published: false/)) {
      continue;
    }

    const status = data.match(/status: (.*)/)[1];
    const date = data.match(/date: (.*)/)[1].trim();

    if (date == "[date]" || isEmpty(date) || data.match(/title: .*\[longDate]/)) {
      exitWithError(`Missing date for ${suspect}`);
    }

    const previewImage = data.match(/.*image:.*\/preview\/(.*\.png|.*\.jpg|.*\.webp)\n/)[1].trim();
    const file = `docs/images/preview/${previewImage}`;




    if (fs.existsSync(file)) {
      continue;
    } else {
      // no preview found, let's try generating one
      info(`Generating preview for ${suspect}`)
      try {
        execSync(`yarn suspect preview -f ${previewImage} -s ${status}`)
        execSync(`git add docs/images/preview`)
      } catch (error) {
        exitWithError(`No preview exists for ${suspect}`)
      }
    }
  }
  return;
}

doVerify();
