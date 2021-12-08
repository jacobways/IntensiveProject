const express = require('express')
const app = express()
const port = 5000
const cors = require("cors");
const chartDataRouter = require("./routes/chartData")
const userRouter = require("./routes/user")

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
  })
);

app.use('/', chartDataRouter)
app.use('/', userRouter)

app.get('/', (req, res) => {
  res.send('Hello World!')
})


// 야메로 하나 만들게
// const { Kospi } = require('./models')
// app.post('/create', (req, res)=>{
//   Kospi.create({
//     date: '2021-12-01',
//     value: 2950
//   })
//   .then(data=>{
//     res.status(200).json({data:data})
//   })
// })


const download = require('download');
const fs = require("fs")
const PDFParser = require("pdf2json");

const { Kospi } = require('./models')
const { Kosdaq } = require('./models')
const { Dow } = require('./models')
const { ExchangeRate } = require('./models')
const { BondInterestRate_ten } = require('./models')
const { OilPrice } = require('./models')
const { ForeignTradeTrend_Kospi } = require('./models')
const { ForeignTradeTrend_Kosdaq } = require('./models')


// 15시 이후의 데이터만 호출하기
function FilterAfternoon (date) {
  return String(date).slice(11,16) > "15:00"
}

// 날짜 데이터에서 순수 YYYY-MM-DD만 추출
function findDate (date) {
  return String(date).slice(0,10)
}

// PDF 문서 내 불필요한 문자열 제거하기 (깨진 문자열)
// + : %2B
// , : %2C
function deleteChr (str) {

  let result = String(str).slice()

  while (result.indexOf('%2B') !== -1) {
    let idx = result.indexOf('%2B')
    result = result.slice(0,idx) + result.slice(idx+3)
  }

  while (result.indexOf('%2C') !== -1) {
    let idx = result.indexOf('%2C')
    result = result.slice(0,idx) + result.slice(idx+3)
  }
  return result
}

// 앞뒤 괄호 제거하기 (외국인 보유 %)
function deleteBr (str) {
  return String(str).slice(1,str.length-1)
}



// API를 호출하기
const request = require('request');
const options = {
  'method': 'GET',
  'url': `https://www.fss.or.kr/fss/kr/openApi/api/fnncMrkt.jsp?apiType=json&startDate=2020-12-01&endDate=2020-12-31&authKey=${process.env.API_KEY}`,
  'headers': {
    'Cookie': 'JSESSIONID=BtBsfEjs7onQalMbym1WGsvFHzxrYQzIjfC3AaqyhTU8K16EpBaylLMYtPDIohuJ.fssweb016_servlet_engine1; WMONID=ZVeBSoI6uXk'
  }
};
request(options, function (error, response, body) {
  if (error) throw new Error(error);

  let info = JSON.parse(body)
  // console.log('info', info);

  // url을 포함하는 객체 엘리먼트 중, 오후 데이터만 담기
  let urls = info['reponse']['result'].filter((data)=>{
    return FilterAfternoon(data['regDate'])
  })

  // url을 포함하는 객체 엘리먼트를 순회하면서 파일을 저장하고, 데이터를 열어서 불러오기
  urls.forEach((url, idx)=>{
    // console.log(url, idx)

    let filename = `./${idx}.pdf`

    let date = findDate(url['regDate'])

    let downloadPDF = async () => {
      fs.writeFileSync(filename, await download(`${url['atchfileUrl']}`));
    }
    
    // PDF 다운로드 받기
    downloadPDF()
    .then(()=>{

      // 다운받은 파일 열기
      const pdfParser = new PDFParser();

      // pdfParser.loadPDF("./testfile.pdf"); 이거 대신 아래 fs 사용

      fs.readFile(filename, (err, pdfBuffer) => {
        if (!err) {
          pdfParser.parseBuffer(pdfBuffer);
        } else {
          console.log(err)
        }
      })
    
      pdfParser.on("pdfParser_dataReady", pdfData => {
        // PDF 파일을 JSON으로 바꾸어 필요한 데이터를 쿼리문으로 DB에 넣기

        // PDF 파일내용 조회 시 아래코드 사용하기
        // console.log('pdfData.Pages[0].Texts---', pdfData.Pages[0].Texts.forEach((el, idx)=>console.log(idx, el.R[0].T)))
        
        
        // pdfData.Pages[0].Texts['인덱스'].R[0].T - 원하는 데이터가 여기에 있음. 이거 활용해서 쿼리문 넣기

        // 인덱스를 찾아야 함
        let idxOfKospi 
        let idxOfKosdaq
        let idxOfDow
        let idxOfexChangeRate
        let idxOfBondInterestDate
        let idxOfOilPrice
        let idxOfForeignKospi
        let idxOfForeignKospi_percent
        let idxOfForeignKosdaq
        let idxOfForeignKosdaq_percent
        
        pdfData.Pages[0].Texts.forEach((el, idx)=> {
          
          if (el.R[0].T==='KOSPI') {idxOfKospi=idx+5}
          if (el.R[0].T==='KOSDAQ') {idxOfKosdaq=idx+5}
          if (el.R[0].T==='%EB%AF%B8%EA%B5%AD(DJIA)%20') {idxOfDow=idx+5}
          if (el.R[0].T==='USDKRW') {idxOfexChangeRate=idx+5}
          if (el.R[0].T==='%E7%BE%8E%20T%2FN(10%EB%85%84)') {idxOfBondInterestDate=idx+5}
          if (el.R[0].T==='%EC%9B%90%EC%9C%A0(WTI%2C%20%EB%B0%B0%EB%9F%B4)') {idxOfOilPrice=idx+5}
          if (el.R[0].T==='%EC%BD%94%EC%8A%A4%ED%94%BC') {idxOfForeignKospi=idx+6}
          if (el.R[0].T==='%EC%BD%94%EC%8A%A4%ED%94%BC') {idxOfForeignKospi_percent=idx+8}
          if (el.R[0].T==='%EC%BD%94%EC%8A%A4%EB%8B%A5') {idxOfForeignKosdaq=idx+6}
          if (el.R[0].T==='%EC%BD%94%EC%8A%A4%EB%8B%A5') {idxOfForeignKosdaq_percent=idx+8}
        })




        function dataArr (idx) {
          return pdfData.Pages[0].Texts[idx].R[0].T
        }
 
        // 쿼리문으로 PDF 데이터를 넣기

        Kospi.create({
          date: date,
          value: deleteChr(dataArr(idxOfKospi))
        })

        Kosdaq.create({
          date: date,
          value: deleteChr(dataArr(idxOfKosdaq))
        })

        Dow.create({
          date: date,
          value: deleteChr(dataArr(idxOfDow))
        })

        ExchangeRate.create({
          date: date,
          value: deleteChr(dataArr(idxOfexChangeRate))
        })

        BondInterestRate_ten.create({
          date: date,
          value: dataArr(idxOfBondInterestDate)
        })

        OilPrice.create({
          date: date,
          value: dataArr(idxOfOilPrice)
        })

        ForeignTradeTrend_Kospi.create({
          date: date,
          value: deleteChr(dataArr(idxOfForeignKospi)),
          percent: deleteBr(dataArr(idxOfForeignKospi_percent))
        })

        ForeignTradeTrend_Kosdaq.create({
          date: date,
          value: deleteChr(dataArr(idxOfForeignKosdaq)),
          percent: deleteBr(dataArr(idxOfForeignKosdaq_percent))
        })
        
      });
    
    })

  })

});



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
