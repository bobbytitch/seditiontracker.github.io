import { readFile, writeFile } from "./file";
import { isEmpty} from 'lodash';

interface Suspect {
  published: boolean
  // data: any
  status?: string
  date?: string
  name?: string
  lastName?: string
  links?: { [type:string]: string }
  age?: number
  image?: string
  preview?: string
  booking?: string
  courtroom?: string
  courthouse?: string
  raid?: string
  occupation?: string
  affiliations?: string
  aka?: string
}

export const getSuspectByFile = (filename:string) => {
  const data = readFile(`./docs/_suspects/${filename}`)
  const suspect: Suspect = { published: true }

  if (/published: false/.test(data)) {
    suspect.published = false
  }

  suspect.status = data.match(/status: (.*)/)[1];

  if (data.match(/date: (.*)/)) {
    suspect.date = data.match(/date: (.*)/)[1].trim();
  }

  suspect.name = data.match(/name: (.*)/)[1];
  suspect.image = data.match(/.*image:.*\/preview\/(.*\.png|.*\.jpg|.*\.webp)\n/)[1].trim();
  suspect.links = getLinks(data.split("---")[2].trim());
  suspect.lastName = suspect.name.split(" ").slice(1).join(" ");

  if (data.match(/age: (\d{1,2})/)) {
    suspect.age = parseInt(RegExp.$1)
  }

  if (data.match(/booking: (.*)/)) {
    suspect.booking = RegExp.$1;
  }

  if (data.match(/courthouse: (.*)/)) {
    suspect.courthouse = RegExp.$1;
  }

  if (data.match(/courtroom: (.*)/)) {
    suspect.courtroom = RegExp.$1;
  }

  if (data.match(/raid: (.*)/)) {
    suspect.raid = RegExp.$1;
  }

  if (data.match(/occupation: (.*)/)) {
    suspect.occupation = RegExp.$1;
  }

  if (data.match(/affiliations: (.*)/)) {
    suspect.affiliations = RegExp.$1;
  }

  if (data.match(/aka: (.*)/)) {
    suspect.aka= RegExp.$1;
  }

  console.log({suspect})

  return suspect
}

export const updateSuspect = (suspect: Suspect) => {

}

const dasherizeName = (suspect:Suspect) => {
  return suspect.name.replace(/\s/g, "-").toLowerCase();
}

const getLinks = (data: string) => {
  const links = {}
  for (const link of data.split("- ")) {
    if (isEmpty(link.trim())) {
      continue;
    }
    const [,name, url] = link.match(/(\[.*])\((.*)\)/)
    links[name] = url
  }
  return links
}