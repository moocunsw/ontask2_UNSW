// Start/End based on UNSW Calendar
// TODO: Add DATA
const terms = [
  {
    "code": 5196,
    "name": "2019 Term 2",
    "start": new Date(2019, 5, 3),
    "end": new Date(2019, 8, 15)
  },
  {
    "code": 5197,
    "name": "2019 Semester 2 Canberra",
    "start": new Date(2019, 6, 29),
    "end": new Date(2019, 10, 16)
  },
  {
    "code": 5199,
    "name": "2019 Term 3",
    "start": new Date(2019, 8, 16),
    "end": new Date(2019, 11, 14)
  }
];

// const terms = [
//   {
//     "code": 5196,
//     "name": "2019 Term 2",
//   },
//   {
//     "code": 5197,
//     "name": "2019 Semester 2 Canberra"
//   },
//   {
//     "code": 5199,
//     "name": "2019 Term 3"
//   }
// ];
// TODO: Sort Descending?

const filterTerms = terms.filter(term => (term.start <= Date.now()) && (Date.now() <= term.end));
export const defaultTerms = filterTerms.map(term => term.code);

export default terms;