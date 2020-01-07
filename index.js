require("dotenv").config()

const fs = require("fs"),
  path = require("path"),
  sa = require("superagent"),
  gapi = require("googleapis"),
  moment = require("moment"),
  slugify = require("./src/utils/text-utils").slugify,
  capCase = require("./src/utils/text-utils").capCase,
  removeCityState = require("./src/utils/helpers").removeCityState,
  fetchedKeysAndDescs = require("./src/utils/gsheets-fetch-keywords"),
  companies = require("./data/company-names.json").companyNames //[
//   ...require("./data/companies-india-1-to-4.json").companyNames,
//   ...require("./data/companies-india-5-to-10").companyNames,
// ]

let gsheetsKandDData = []

let data = {}

let gcse = gapi.google.customsearch("v1")

runTemplateGen()

async function runTemplateGen() {
  gsheetsKandDData = await fetchedKeysAndDescs()

  for (let i = 0; i < companies.length; i++) {
    try {
      let tempCompany = companies[i].replace(/\+/g, "%2b").replace(/&/g, "%26")
      const res = await sa.get(
        `https://api.pipelinedeals.com/api/v3/deals.json?api_key=RMWETsZ4iByDaxWkFjx&conditions[company_name]=${tempCompany}`
      )

      //* bsns email custom_label_1585966
      //* phone custom_label_1585963
      //* service area custom_label_1585981
      //* web_desc custom_label_3038791
      //* hours custom_label_1454392
      //* primary phrase custom_label_1807174
      //* keywords custom_label_1454401
      //* gmb address custom_label_1454398
      //* facebook desc custom_label_1486885
      // console.log(res);

      let entry = null

      if (JSON.parse(res.text).entries[0] != null) {
        entry = JSON.parse(res.text).entries[0]
      } else {
        throw new Error("API data failed")
      }

      // console.log(entry)
      let keywords = entry.custom_fields.custom_label_1454401
      let keyword = ""
      //TODO: find a way to pair keywords matching with their descriptions
      if (keywords != null) {
        if (keywords.split(/\r?\n/)[0].replace(/[\W\S\d]/g, "").length > 0) {
          // Remove numbers and symbols
          keyword = keywords.split(/\r?\n/)[0].replace(/[\W\S\d]/g, "")
        } else {
          keyword = keywords.split(/\r?\n/)[1]
        }
      }
      // console.log(`MY KEYWORD IS: ${keyword}`)

      data.companyName =
        entry.company != null ? entry.company.name : "{COMPANY_NAME}"

      data.phone =
        entry.custom_fields.custom_label_1585963 != null
          ? entry.custom_fields.custom_label_1585963
          : "{PHONE}"

      data.email =
        entry.custom_fields.custom_label_1585966 != null
          ? entry.custom_fields.custom_label_1585966
          : "{EMAIL}"

      data.hours =
        entry.custom_fields.custom_label_1454392 != null
          ? entry.custom_fields.custom_label_1454392.replace(/\r?\n/g, " ")
          : "{HOURS}"

      data.field =
        entry.custom_fields.custom_label_1807174 != null
          ? removeCityState(entry.custom_fields.custom_label_1807174)
          : "{FIELD}"

      let location = null
      if (
        entry.custom_fields.custom_label_1585981 != null &&
        entry.custom_fields.custom_label_1454398.match(/([A-z]+),? [A-Z]{2}/) !=
          null
      ) {
        location = entry.custom_fields.custom_label_1454398.match(
          /([A-z]+),? [A-Z]{2}/
        )[0]
      } else {
        location = "{LOCATION}"
      }

      data.location = location

      //* Descriptions
      data.web_desc1 = parseDesc(
        entry.custom_fields.custom_label_3038791,
        entry.custom_fields.custom_label_1486885
      )

      let web_desc2 =
        entry.custom_fields.custom_label_3038791 != null
          ? entry.custom_fields.custom_label_3038791.split(/\r?\n/)[7]
            ? entry.custom_fields.custom_label_3038791.split(/\r?\n/)[7]
            : "{WEB DESCRIPTION 2}"
          : "{WEB DESCRIPTION 2}"
      data.web_desc2 = web_desc2.replace(/"/g, '\\"')

      data.keywords =
        keywords != null
          ? keywords.split(/\r?\n/).slice(1, 5)
          : Array.from({ length: 5 }, (v, k) => `{KEYWORD ${k + 1}}`)

      //* Images
      if (keyword.length > 0) data.images = await fetchGImages(removeCityState(keyword))

      enterContent(data)

      const log = `------------------------
${entry.company.name}
---
${entry.custom_fields.custom_label_1585966 /* email */}
---
${entry.custom_fields.custom_label_1585963 /* phone */}
---
${data.location}
---
${data.web_desc1}
---
${data.web_desc2}
------------------------`
      console.log(log)
    } catch (err) {
      console.log("ERR:")
      console.log(err)
      writeError(err, { companyName: companies[i] })
    }
  }
}

/**
 * Prases the description pulled from PLD, will use the standard description if it exists,
 * if it doesnt, will attempt to use
 * @param {String} desc Standard website description
 * @param {String} fbDesc Facebook website description
 */
function parseDesc(desc, fbDesc) {
  let parsedDesc = ""

  if (desc != null) {
    // primary web desc is good and string is valid
    parsedDesc = desc.split(/\r?\n/)[0].replace(/\.[\w\s]+:/, ".")
  } else if (fbDesc != null) {
    // facbook desc
    parsedDesc = fbDesc
  } else {
    parsedDesc = "{WEB DESCRIPTION 1}"
  }

  return parsedDesc.replace(/"/g, '\\"')
}

async function fetchGImages(q) {
  console.log(q)

  let res = await gcse.cse.list({
    cx: process.env.google_cse_cx_id_1,
    auth: process.env.google_api_key,
    q: q,
    searchType: "image",
    imgSize: "xlarge",
  })
  console.log(res.data.items[1].link.replace(/\//g, "\\/"))

  return res.data.items.map(item =>
    item.link.replace(/\//g, "\\/").replace(/\?.*/g, "")
  )
}

function enterContent(data) {
  let content = fs.readFileSync(
    path.join(__dirname, "data", "blank-template-2.json"),
    "utf8"
  )

  content = content.replace(/\${company_name}/g, data.companyName)
  content = content.replace(/\${hours}/g, data.hours)
  content = content.replace(/\${phone}/g, data.phone)
  content = content.replace(/\${email}/g, data.email)
  content = content.replace(/\${field}/g, data.field)
  content = content.replace(/\${location}/g, data.location)
  content = content.replace(/\${web_desc_1}/g, data.web_desc1)
  content = content.replace(/\${web_desc_2}/g, data.web_desc2)

  // Apply images

  if (data.images) {
    content = content.replace(/\${featured_img}/g, data.images[1])
    content = content.replace(/\${featured_img_2}/g, data.images[2])
    content = content.replace(/\${slider_img_1}/g, data.images[3])
    content = content.replace(/\${slider_img_2}/g, data.images[4])
    content = content.replace(/\${slider_img_3}/g, data.images[5])
  } else {
    content = content.replace(
      /\${featured_img}/g,
      "https:\\/\\/images.arcadis.com\\/media\\/B\\/B\\/A\\/%7BBBA972D3-97ED-4C9F-9C4D-12E15AE3381D%7Dcontractor-1.jpg"
    )
    content = content.replace(
      /\${featured_img_2}/g,
      "https:\\/\\/accessiblehousingservices.com\\/wp-content\\/uploads\\/2015\\/09\\/Accessible-Remodel-Hire-Contractor.jpg"
    )
    content = content.replace(
      /\${slider_img_1}/g,
      "https:\\/\\/geniebelt.com\\/wp-content\\/uploads\\/27706-1024x795.jpg"
    )
    content = content.replace(
      /\${slider_img_2}/g,
      "https:\\/\\/allmasonry.com\\/wp-content\\/uploads\\/2015\\/02\\/construction-management.jpg"
    )
    content = content.replace(
      /\${slider_img_3}/g,
      "http:\\/\\/www.kiplinger.com\\/kipimages\\/pages\\/17487.jpg"
    )
  }

  // Parse keyword and description data
  const dummyDescData = [
    "Ready to upgrade your bathroom? Give us a call today!",
    "Let us help make your dream kitchen a reality in your home.",
    "Call us for other home remodeling services too!",
    "We can custom build your new home!",
  ]
  data.keywords.map((keyword, i) => {
    //loop through each keyword until match is found -> assign desc pair
    let matchedDesc = null
    for (let i = 0; i < gsheetsKandDData.length; i++) {
      if (
        keyword.trim().toLowerCase() ==
        gsheetsKandDData[i][0].trim().toLowerCase()
      ) {
        matchedDesc = gsheetsKandDData[i][1]
        break
      }
    }

    content = content.replace(`\${KEY${i + 1}}`, capCase(keyword))
    content = content.replace(
      `\${DESC${i + 1}}`,
      matchedDesc ? matchedDesc : dummyDescData[i]
    )
  })

  // Remove return lines and replace tabs with whitespace
  content = content.replace(/\r?\n/g, "")
  content = content.replace(/\t/g, " ")

  fs.mkdirSync(`${__dirname}/templates/${slugify(data.companyName)}`, {
    recursive: true,
  })

  fs.writeFileSync(
    `templates/${slugify(data.companyName)}/template.json`,
    content.trim()
  )
}

function writeError(err, data) {
  fs.mkdirSync(`${__dirname}/logs`, {
    recursive: true,
  })
  let logFile = ""

  if (fs.existsSync(path.join(__dirname, "logs", "errors.log"))) {
    logFile = fs.readFileSync(path.join(__dirname, "logs", "errors.log"))
  }

  console.log(logFile.toString())

  const errLog = `
======================================================
Log ${moment().format("MM/DD HH:mm:ss")}:
for: ${data.companyName}
${err}
======================================================
  `

  if (!fs.existsSync(path.join(__dirname, "logs", "errors.log"))) {
    fs.writeFileSync(path.join(__dirname, "logs", "errors.log"), errLog)
  } else {
    fs.writeFileSync(
      path.join(__dirname, "logs", "errors.log"),
      errLog + `\n ${logFile.toString()}`
    )
  }
}
