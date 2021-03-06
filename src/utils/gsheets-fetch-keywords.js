require("dotenv").config()

const fs = require("fs").promises
const util = require("util")
const readline = require("readline")
const { google } = require("googleapis")

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "./data/token.json"

// Promisfy readFile to await until ghseets data is fetched
const readFile = util.promisify(fs.readFile)

let fetchedData = []

async function fetchedKeysAndDescs() {
  // Load client secrets from a local file.
  // const data = await fs.readFile("./data/credentials.json", async (err, content) => {
  //   await console.log("middle")
  //   if (err) return console.log("Error loading client secret file:", err)
  //   //Authorize a client with credentials, then call the Google Sheets API.
  //   await authorize(JSON.parse(content), listMajors)
  // })

  const content = await fs.readFile("./data/credentials.json")

  await authorize(JSON.parse(content), listMajors)

  // let content = fs.readFileSync("./data/credentials.json")
  // await authorize(JSON.parse(content), listMajors)

  return fetchedData
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  )

  // Check if we have previously stored a token.
  const token = await fs.readFile(TOKEN_PATH)
  // , (err, token) => {
  //   if (err) return getNewToken(oAuth2Client, callback)
  //   oAuth2Client.setCredentials(JSON.parse(token))
  //   callback(oAuth2Client)
  // })

  oAuth2Client.setCredentials(JSON.parse(token))
  await callback(oAuth2Client)
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  })
  console.log("Authorize this app by visiting this url:", authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  rl.question("Enter the code from that page here: ", code => {
    rl.close()
    oAuth2Client.getToken(code, (err, token) => {
      if (err)
        return console.error("Error while trying to retrieve access token", err)
      oAuth2Client.setCredentials(token)
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), err => {
        if (err) return console.error(err)
        console.log("Token stored to", TOKEN_PATH)
      })
      callback(oAuth2Client)
    })
  })
}

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function listMajors(auth) {
  const sheets = google.sheets({ version: "v4", auth })
  const sheetData = await sheets.spreadsheets.values.get(
    {
      // spreadsheetId: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
      spreadsheetId: "1TFVlpmELCoOniyCF1H8cTtc_IMnLgb5DfS8-L6omoDk",
      range: "A2:B",
    }
    // },
    // (err, res) => {
    //   if (err) return console.log("The API returned an error: " + err)
    //   const rows = res.data.values
    //   // Global data to pull up from this script
    //   fetchedData = rows
    //   console.log(fetchedData)
    //   if (rows.length) {
    //     console.log("Name, Major:")
    //     // Print columns A and E, which correspond to indices 0 and 4.
    //     rows.map(row => {
    //       console.log(`${row[0]}, ${row[1]}`)
    //     })
    //   } else {
    //     console.log("No data found.")
    //   }
    // }
  )

  // console.log(sheetData.data.values)
  fetchedData = sheetData.data.values
}

module.exports = fetchedKeysAndDescs
