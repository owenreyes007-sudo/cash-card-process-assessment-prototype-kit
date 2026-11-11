/* Northstar target records (fictional). Records carry the dated facts the diagnostic builds its history from, so every
   timeline stays consistent with the card, delivery, replacement and transaction it refers to.
   Card roles: 1842, 6620, 8115 = delivered, awaiting activation | 3306, 5518, 7040 = in use | 4821, 2290, 9037 = being or already replaced.
   Chain: RP-76882 replaced card 4821 -> new card 6620 (fulfilled Oct 11, DL-61983 delivered Oct 15). */
window.NorthstarDiagnosticRecords = {
  activation: {
    title: 'Select Card to Diagnose', kind: 'card', prompt: 'card',
    records: [
      {id:'card-1842', label:'Northstar debit card', identifier:'Card ending 1842', card:'1842', deliveredOn:'Oct 12, 2026', detail:'Issued Oct 05, 2026 · Physical card'},
      {id:'card-6620', label:'Replacement debit card', identifier:'Card ending 6620', card:'6620', deliveredOn:'Oct 15, 2026', detail:'Replacement for card ending 4821 · RP-76882'},
      {id:'card-8115', label:'Northstar debit card', identifier:'Card ending 8115', card:'8115', deliveredOn:'Oct 14, 2026', detail:'Issued Oct 09, 2026 · Physical card'}
    ]
  },
  decline: {
    title: 'Select Transaction to Diagnose', kind: 'transaction', prompt: 'payment attempt', searchable: true,
    records: [
      {id:'txn-884201', label:'Corner Coffee', identifier:'TXN-884201', card:'3306', date:'Oct 19, 2026 · 8:42 AM', amount:'$38.50 USD', amountValue:38.50, icon:'coffee', sub:'Food & drink', detail:'Card ending 3306'},
      {id:'txn-884155', label:'Market Square', identifier:'TXN-884155', card:'3306', date:'Oct 18, 2026 · 6:14 PM', amount:'$42.18 USD', amountValue:42.18, icon:'shop', sub:'Groceries', detail:'Card ending 3306'},
      {id:'txn-883992', label:'Metro Ride', identifier:'TXN-883992', card:'5518', date:'Oct 17, 2026 · 9:03 AM', amount:'$31.75 USD', amountValue:31.75, icon:'ride', sub:'Travel', detail:'Card ending 5518'}
    ]
  },
  delivery: {
    title: 'Select Delivery Request', kind: 'delivery', prompt: 'delivery request',
    records: [
      {id:'del-62014', label:'Card delivery request', identifier:'DL-62014', card:'1842', date:'Oct 05, 2026', shipped:'Oct 08, 2026', delivered:'Oct 12, 2026', detail:'Card ending 1842 · Requested Oct 05, 2026'},
      {id:'del-61983', label:'Card delivery request', identifier:'DL-61983', card:'6620', date:'Oct 11, 2026', shipped:'Oct 12, 2026', delivered:'Oct 15, 2026', detail:'Card ending 6620 · Requested Oct 11, 2026'},
      {id:'del-62102', label:'Card delivery request', identifier:'DL-62102', card:'8115', date:'Oct 09, 2026', shipped:'Oct 12, 2026', delivered:'Oct 14, 2026', detail:'Card ending 8115 · Requested Oct 09, 2026'}
    ]
  },
  replacement: {
    title: 'Select Replacement Request', kind: 'replacement', prompt: 'replacement request',
    records: [
      {id:'rep-77104', label:'Replacement inquiry', identifier:'RP-77104', card:'2290', otherCard:'3306', date:'Oct 12, 2026', fulfilled:'Oct 13, 2026', delivered:'Oct 17, 2026', detail:'Card ending 2290 · Opened Oct 12, 2026'},
      {id:'rep-76882', label:'Card replacement request', identifier:'RP-76882', card:'4821', otherCard:'2290', date:'Oct 10, 2026', fulfilled:'Oct 11, 2026', delivered:'Oct 15, 2026', detail:'Card ending 4821 · Opened Oct 10, 2026'},
      {id:'rep-77215', label:'Replacement inquiry', identifier:'RP-77215', card:'9037', otherCard:'3306', date:'Oct 13, 2026', fulfilled:'Oct 14, 2026', delivered:'Oct 18, 2026', detail:'Card ending 9037 · Opened Oct 13, 2026'}
    ]
  },
  notworking: {
    title: 'Select Card to Diagnose', kind: 'card', prompt: 'card',
    records: [
      {id:'use-3306', label:'Northstar debit card', identifier:'Card ending 3306', card:'3306', attempt:'TXN-883991', attemptWhen:'Oct 19, 2026 · 6:14 PM', detail:'Latest attempt TXN-883991 · Oct 19, 2026'},
      {id:'use-5518', label:'Northstar debit card', identifier:'Card ending 5518', card:'5518', attempt:'TXN-884309', attemptWhen:'Oct 20, 2026 · 10:04 AM', detail:'Latest attempt TXN-884309 · Oct 20, 2026'},
      {id:'use-7040', label:'Northstar debit card', identifier:'Card ending 7040', card:'7040', attempt:'TXN-884420', attemptWhen:'Oct 20, 2026 · 4:51 PM', detail:'Latest attempt TXN-884420 · Oct 20, 2026'}
    ]
  },
  restrictions: {
    title: 'Select Card to Diagnose', kind: 'card', prompt: 'card',
    records: [
      {id:'control-3306', label:'Northstar debit card', identifier:'Card ending 3306', card:'3306', control:'CT-1028', controlWhen:'Oct 19, 2026 · 8:32 PM', detail:'Card controls event CT-1028'},
      {id:'control-5518', label:'Northstar debit card', identifier:'Card ending 5518', card:'5518', control:'CT-1031', controlWhen:'Oct 20, 2026 · 9:10 AM', detail:'Card controls event CT-1031'},
      {id:'control-7040', label:'Northstar debit card', identifier:'Card ending 7040', card:'7040', control:'CT-1040', controlWhen:'Oct 20, 2026 · 5:02 PM', detail:'Card controls event CT-1040'}
    ]
  }
};

