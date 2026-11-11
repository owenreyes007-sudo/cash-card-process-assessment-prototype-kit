/* Northstar condition libraries and the deterministic, evidence-based evaluator.
   PROVENANCE (never shown in the UI): every condition is a configurable fictional outcome with its own fictional event
   history. None asserts a verified Cash App or Marqeta production rule, and none names a real queue or team.
   MODEL
   - Account facts (cardStatus, risk, hold, delivery, balanceLow) are asserted by conditions via `facts` and are SHARED across
     every concern (IMPLIED maps a fact to the condition that surfaces it). Conditions that assert different values for the
     same fact conflict in any concern, so the account never contradicts itself.
   - Dates come from the selected record, so histories match the record. A declined transaction records ONE decline reason.
   - Actions are decisions, not reviews. "^" marks a step outside this tool. "|tag" marks a repeatable instruction that is dropped
     once the customer has already done it. `done` = what the customer or advocate already did or ruled out; `skip` = instructions
     NOT to give again. Case-note conditions (note) add that history (and contact-history rows) without adding findings.
   Condition: { id, label, kind: blocker|unknown|info|clear, exclusive, hidden, excludes[], needs[], facts, reason, note, done(r,w), skip[], findings(r,w), events(r,w) } */
(() => {
  const BAL = 24.00, D = 1440;
  const at = (d, h = 12, m = 0) => d * D + h * 60 + m;
  const tsOf = s => { const m = /(Sep|Oct) (\d+), 2026(?: · (\d+):(\d+) (AM|PM))?/.exec(s); const h = m[3] ? (+m[3] % 12) + (m[5] === 'PM' ? 12 : 0) : 12; return at(+m[2] - (m[1] === 'Sep' ? 30 : 0), h, m[4] ? +m[4] : 0); };
  const dateStr = ts => `Oct ${Math.floor(ts / D)}, 2026`;
  const SUSP = at(16, 9, 40);                       /* account-wide suspension time, before every configured attempt */
  const E = (ts, text, res = 'info', dateOnly = false, label) => ({ ts, text, res, dateOnly, label });
  const F = (title, evidence, why, actions, customer, extra = {}) => ({ title, evidence, why, actions, customer, ...extra });
  const C = (id, label, kind, findings, events, o = {}) => ({ id, label, kind, findings, events: events || (() => []), exclusive: false, hidden: false, excludes: [], needs: [], facts: {}, done: () => [], skip: [], ...o });
  const NOTE = (id, label, needs, note, o = {}) => C(id, label, 'info', () => [], r => [E(note.when ? note.when(r) : tsOf(note.date), `Case note · ${note.text}`, 'info')], { needs, needsLabel: 'a related condition', note, ...o });
  const RISKCUST = 'Your account needs an additional review before this can go ahead. We will let you know what is needed next.';
  const RISKACT = ['Tell the customer an account review is needed before this can go ahead. Do not share the risk classification.', '^Route the account through your risk-review procedure and note the case.'];
  const HOLDACT = ['Tell the customer a restriction on the account is blocking card payments and no retry will work until it is cleared.', '^Resolve the hold under your hold procedure. Do not commit to an end date.'];
  const riskFinding = (r, w, ctx) => F(`Risk review indicator: ${w.risk}`, `Account risk indicator: ${w.risk}`, `A risk indicator on the account ${ctx}. It is an indicator, not a confirmed finding about the customer.`, RISKACT, RISKCUST, { sensitive: true });
  const suspFinding = (r, why) => F('Card status: Suspended', `Card ending ${r.card} · Processor status: Suspended since Oct 16, 2026`, why, ['Tell the customer the card is suspended, so it cannot be used or activated right now.', '^Clear the suspension on the card, or order a replacement if it cannot be cleared.'], 'Your card cannot be used right now. We are reviewing it and will tell you the next step.');
  const lockedFinding = r => F('Card status: Locked', `Card ending ${r.card} · Locked in card controls`, 'The card is locked in card controls, which stops payments until it is unlocked.', ['Ask the customer to unlock the card in card controls, then make one new payment.'], 'Your card is locked in its controls. Unlocking it in the app lets payments go through again.');
  const holdFinding = r => F('Account restriction: Account hold', 'Account restriction indicator: Hold recorded', 'A hold on the account restricts card payments, so changes to the card alone will not clear it.', HOLDACT, 'There is a restriction on your account that is affecting card payments. We are reviewing it and will update you on next steps.');

  const lib = {
    activation: [
      C('act-suspended', 'Card suspended', 'blocker', r => [suspFinding(r, 'The card is suspended, so it cannot be activated until that status changes.')],
        r => [E(SUSP, 'Card status changed to Suspended', 'fail')], { facts: { cardStatus: 'Suspended' }, excludes: ['act-later'], skip: ['retry', 'reinstall'] }),
      C('act-denylist', 'Risk indicator: account denylisted', 'blocker', (r, w) => [F('Risk review indicator: Denylisted', 'Account risk indicator: Denylisted', 'A risk indicator on the account is preventing activation. The record does not state the reason.', RISKACT, RISKCUST, { sensitive: true })],
        r => [E(at(20, 9, 55), 'Activation stopped by an account risk indicator', 'fail')], { facts: { risk: 'Denylisted' }, excludes: ['act-later', 'act-verify'], skip: ['retry', 'reinstall', 'verify'] }),
      C('act-fraud', 'Risk indicator: suspected fraud', 'blocker', (r, w) => [F('Risk review indicator: Suspected fraud', 'Account risk indicator: Suspected fraud', 'A risk indicator is recorded on the account. It is an indicator, not a confirmed finding about the customer.', RISKACT, RISKCUST, { sensitive: true })],
        r => [E(at(20, 9, 55), 'Activation stopped by an account risk indicator', 'fail')], { facts: { risk: 'Suspected fraud' }, excludes: ['act-later', 'act-verify'], skip: ['retry', 'reinstall', 'verify'] }),
      C('act-verify', 'Attempt stopped: verification not completed', 'blocker',
        r => [F('Activation verification not completed', `Activation event AC-${r.card}7 · Verification result: not completed`, 'Activation requires a completed verification and none is recorded for this attempt.', ['Verify the customer’s identity with them now, then have them activate once.', '^Record the verification result on the account.'], 'We need to verify a few details before your card can be activated. After that you can try activating again.')],
        r => [E(at(20, 10, 5), 'Activation attempt stopped at verification', 'fail')], { excludes: ['act-failed', 'act-multi', 'act-unknown', 'act-later', 'act-denylist', 'act-fraud'], done: () => ['Started activation; it stopped at the verification step'], skip: ['reinstall'] }),
      C('act-failed', 'One failed attempt with recorded error ACT-4102', 'blocker',
        r => [F('Activation failed: error ACT-4102', `Activation event AC-${r.card}7 · Failed · ACT-4102 (verification incomplete)`, 'The only recorded attempt ended with ACT-4102, which states that verification was not completed.', ['^Complete the verification step behind ACT-4102 on the account.', 'Then have the customer activate once. Tell them not to retry before that.'], 'Activation did not complete because a verification step was not finished. Once that is resolved you can try again.')],
        r => [E(at(20, 15, 12), 'Activation attempt failed · ACT-4102 (verification incomplete)', 'fail')], { excludes: ['act-verify', 'act-multi', 'act-unknown', 'act-later'], done: () => ['Attempted activation Oct 20 · 3:12 PM · failed with ACT-4102'], skip: ['retry', 'reinstall'] }),
      C('act-multi', 'Repeated failed attempts, same error', 'blocker',
        r => [F('Repeated activation failures: ACT-4102', `Activation events AC-${r.card}5 to AC-${r.card}7 · 3 failed · ACT-4102`, 'Three attempts over two days ended with the same error, so retrying is not changing the outcome.', ['^Complete the verification step behind ACT-4102 on the account.', 'Tell the customer more retries will not work until that is done.'], 'Activation has not worked after several tries because a verification step was not finished. Please hold off retrying while we fix it.')],
        r => [E(at(19, 18, 30), '3 activation attempts failed · all ACT-4102 (verification incomplete)', 'fail', false, 'Oct 19–20')], { excludes: ['act-verify', 'act-failed', 'act-unknown', 'act-later'], done: () => ['Attempted activation 3 times, Oct 19–20 · all failed with ACT-4102'], skip: ['retry', 'reinstall'] }),
      C('act-unknown', 'Failed attempt, error not recorded', 'unknown',
        r => [F('Unable to determine why activation failed', `Activation event AC-${r.card}7 · Failed · No error or verification result recorded`, 'The attempt failed, but the record has no error code or verification result, so a cause cannot be established.', ['^Get the error code from the activation event for this attempt before advising a fix.', 'Ask the customer what the screen showed when activation failed, and note it.', 'Ask the customer to update the app and retry once.|reinstall'], 'We are looking into why activation did not complete and will confirm what is needed next.')],
        r => [E(at(20, 15, 12), 'Activation attempt failed · no error recorded', 'fail')], { excludes: ['act-verify', 'act-failed', 'act-multi', 'act-later'], done: () => ['Attempted activation Oct 20 · 3:12 PM · failed, no error recorded'] }),
      C('act-later', 'Earlier attempt failed, later attempt succeeded', 'clear',
        r => [F('Activation completed on a later attempt', `Card ending ${r.card} · Activated Oct 20, 2026 · 9:48 AM`, 'The earlier failure was followed by a successful activation, so the card is now active.', ['Confirm the card works. Nothing further to do.'], 'Your card is now active and ready to use.')],
        r => [E(at(19, 15, 12), 'Activation attempt failed · ACT-4102', 'fail'), E(at(20, 9, 48), 'Activation attempt succeeded · card active', 'ok')],
        { facts: { cardStatus: 'Active', risk: 'none', hold: 'none', delivery: 'Delivered' }, excludes: ['act-suspended', 'act-denylist', 'act-fraud', 'act-verify', 'act-failed', 'act-multi', 'act-unknown'], done: () => ['Activation failed Oct 19, then succeeded Oct 20 · 9:48 AM'] }),
      C('act-notreceived', 'Card not yet received', 'blocker', (r, w) => [F('Card not yet received', `Card ending ${r.card} · Delivery status: ${w.delivery}`, 'Activation cannot start until the card is in the customer’s hands, so the open delivery issue comes first.', ['Tell the customer activation is not possible until the card arrives.', 'Run the Card delivery diagnostic for this card and resolve delivery first.'], 'Your card has not reached you yet, so it cannot be activated. We are checking where it is.')],
        r => [], { hidden: true, skip: ['retry'] }),
      C('act-clear', 'No blocker: not yet activated, no attempt recorded', 'clear',
        r => [F('No activation blocker detected', `Card ending ${r.card} · Delivered ${r.deliveredOn} · No activation attempt on record`, 'The card is in its expected initial state. Not being activated yet is not a failure, and nothing is preventing activation.', ['Walk the customer through activation. This is their first attempt.'], 'Your card has arrived and is ready to activate. Once you complete activation you can start using it.')],
        r => [E(tsOf(r.deliveredOn), 'Card delivered', 'ok', true)], { exclusive: true, done: r => [`Card received · delivered ${r.deliveredOn}`] }),
      NOTE('act-tried-app', 'Case note: customer already updated and reinstalled the app', ['act-failed', 'act-multi', 'act-unknown', 'act-verify'],
        { date: 'Oct 20, 2026 · 4:05 PM', channel: 'Chat', text: 'customer updated and reinstalled the app, then retried activation with the same result' },
        { done: () => ['Updated and reinstalled the app, then retried activation (case note)'], skip: ['reinstall'] })
    ],
    decline: [
      C('dec-reason', 'Declined: insufficient available balance', 'blocker',
        r => [F('Declined: insufficient available balance', `${r.identifier} · ${r.amount} attempted · Available balance $${BAL.toFixed(2)}`, 'The purchase amount was higher than the available balance when it was attempted.', [`Tell the customer the purchase failed because the available balance ($${BAL.toFixed(2)}) was below ${r.amount.replace(' USD', '')}.`, 'Ask them to add funds or use another payment method. The card works once funds cover it.'], 'The payment was declined because the available balance was lower than the purchase amount. It can be attempted again once your balance covers it.')],
        null, { facts: { balanceLow: 'yes' }, reason: { rank: 5, text: 'insufficient available balance' }, excludes: ['dec-unavail', 'dec-later'] }),
      C('dec-card', 'Declined: card was locked', 'blocker', r => [lockedFinding(r)],
        r => [E(tsOf(r.date) - 30, 'Card locked in card controls', 'info')], { facts: { cardStatus: 'Locked' }, reason: { rank: 2, text: 'card locked' }, excludes: ['dec-later', 'dec-unavail'] }),
      C('dec-restriction', 'Declined: account hold', 'blocker', r => [holdFinding(r)],
        null, { facts: { hold: 'yes' }, reason: { rank: 4, text: 'account hold' }, excludes: ['dec-later', 'dec-unavail'], skip: ['retry'] }),
      C('dec-fraud', 'Declined: suspected-fraud indicator', 'blocker', (r, w) => [F('Risk review indicator: Suspected fraud', `Risk indicator recorded at the time of ${r.identifier}`, 'A risk indicator on the account coincides with the decline. It is an indicator, not a confirmed finding.', RISKACT, RISKCUST, { sensitive: true })],
        null, { facts: { risk: 'Suspected fraud' }, reason: { rank: 3, text: 'account risk indicator' }, excludes: ['dec-later', 'dec-unavail'], skip: ['retry'] }),
      C('dec-suspended', 'Declined: card suspended', 'blocker', r => [suspFinding(r, 'A suspended card cannot complete payments.')], null, { hidden: true, facts: { cardStatus: 'Suspended' }, reason: { rank: 1, text: 'card suspended' }, skip: ['retry'] }),
      C('dec-denylist', 'Declined: account denylisted', 'blocker', r => [F('Risk review indicator: Denylisted', `Risk indicator recorded at the time of ${r.identifier}`, 'A risk indicator on the account coincides with the decline. The record does not state the reason.', RISKACT, RISKCUST, { sensitive: true })], null, { hidden: true, facts: { risk: 'Denylisted' }, reason: { rank: 3, text: 'account risk indicator' }, skip: ['retry'] }),
      C('dec-unavail', 'Declined: reason not recorded', 'unknown',
        r => [F('Unable to determine why it was declined', `${r.identifier} · Declined · Decline reason field not available`, 'The decline is recorded, but its reason is not, so the cause cannot be established from this record.', ['^Get the decline code from the authorization record for this transaction.', 'Ask the customer what message the terminal or app showed.', 'Ask them to retry once at another terminal.|terminal'], 'We can see the payment was declined and are checking the reason. We will confirm what is needed next.')],
        null, { reason: { rank: 99, text: 'reason not recorded' }, excludes: ['dec-reason', 'dec-card', 'dec-restriction', 'dec-fraud', 'dec-later'], done: r => [`Attempted ${r.label} purchase · declined, no reason recorded`] }),
      C('dec-retry', 'Customer retried; declined again', 'info',
        r => [F('Retry also declined', `${r.identifier} · Second attempt a few minutes later · Declined`, 'Retrying did not change the outcome, so the cause has not been resolved.', [], null)],
        r => [E(tsOf(r.date) + 6, `Customer retried ${r.label} · declined again`, 'fail')], { needs: ['dec-reason', 'dec-card', 'dec-restriction', 'dec-fraud', 'dec-unavail'], needsLabel: 'a decline reason', excludes: ['dec-later'], done: r => [`Retried the same ${r.label} purchase minutes later · declined again`], skip: ['retry'] }),
      C('dec-later', 'Declined, then a later attempt was approved', 'clear',
        r => [F('Later attempt approved', `${r.identifier} declined · A later ${r.label} purchase of ${r.amount} was approved`, 'The decline was followed by an approved attempt, so card payments are working now.', ['Nothing further. Confirm the later payment covered what the customer needed.'], 'Your later payment went through.')],
        r => [E(tsOf(r.date), `${r.label} purchase declined`, 'fail'), E(tsOf(r.date) + 13, `Later ${r.label} purchase approved`, 'ok')],
        { facts: { cardStatus: 'Active', risk: 'none', hold: 'none' }, excludes: ['dec-reason', 'dec-card', 'dec-restriction', 'dec-fraud', 'dec-unavail', 'dec-retry'], done: r => [`Declined, then made a later ${r.label} purchase that was approved`] }),
      C('dec-clear', 'No blocker: transaction was approved', 'clear',
        r => [F('No issue-specific blocker detected', `${r.identifier} · ${r.amount} · Approved`, 'The selected transaction was approved, so it does not match a declined payment.', ['Ask which payment failed (merchant, time, amount). This purchase was approved.'], 'This payment shows as approved on our side. Can you confirm the merchant and time of the one that failed?')],
        r => [E(tsOf(r.date), `${r.label} purchase of ${r.amount} approved`, 'ok')], { exclusive: true, done: r => [`${r.label} purchase of ${r.amount.replace(' USD', '')} was approved`] }),
      NOTE('dec-tried-other', 'Case note: customer already tried another terminal', ['dec-reason', 'dec-card', 'dec-restriction', 'dec-fraud', 'dec-unavail'],
        { when: r => tsOf(r.date) + 40, text: 'customer tried the same card at another terminal and it was declined', channel: 'Chat', date: 'Oct 19, 2026 · 9:30 AM' },
        { done: () => ['Tried the same card at another terminal (case note) · declined'], skip: ['terminal', 'retry'] })
    ],
    delivery: [
      C('del-progress', 'Delivery in progress', 'info',
        r => [F('Delivery in progress', `${r.identifier} · In transit · Estimated delivery Oct 24, 2026`, 'The card is moving through shipment and the estimated date has not passed. Nothing is blocking delivery.', ['Give the customer the tracking status and the Oct 24 estimate. Nothing else is needed yet.'], 'Your card is on its way. The current estimate is Oct 24, and we will update you if that changes.')],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(at(19, 12), 'Card shipped', 'ok', true), E(at(20, 12), 'In transit · estimated delivery Oct 24', 'info', true)],
        { facts: { delivery: 'In transit' }, excludes: ['del-delayed', 'del-exception', 'del-addr', 'del-unavail', 'del-complete'], done: r => [`Ordered the card ${r.date}`] }),
      C('del-delayed', 'Delivery delayed past the estimate', 'blocker',
        r => [F('Delivery delayed', `${r.identifier} · Estimated ${dateStr(tsOf(r.shipped) + 7 * D)} · No delivery event as of Oct 21, 2026`, 'The shipment passed its estimated delivery date without a delivery event.', ['Confirm the delivery address on the order with the customer.|address', '^Open a trace on the shipment, or reissue the card if it has not moved.'], 'Your card is taking longer than estimated to arrive. We are looking into the shipment and will confirm next steps.')],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(tsOf(r.shipped), 'Card shipped', 'ok', true), E(tsOf(r.shipped) + 7 * D, 'Estimated delivery date passed · no delivery event', 'fail', true)],
        { facts: { delivery: 'Delayed' }, excludes: ['del-progress', 'del-addr', 'del-unavail', 'del-complete'], done: r => [`Ordered the card ${r.date} and waited past the estimate`] }),
      C('del-exception', 'Delivery exception: address confirmation required', 'blocker',
        r => [F('Delivery exception: address confirmation required', `${r.identifier} · Latest shipment event: Exception · Oct 19, 2026 · 2:10 PM`, 'The carrier could not complete delivery and needs the address confirmed.', ['Confirm the full delivery address with the customer.|address', '^Update the address on the shipment so the carrier can reattempt.'], 'The delivery could not be completed and the address needs to be confirmed. Once confirmed, delivery can be attempted again.')],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(tsOf(r.shipped), 'Card shipped', 'ok', true), E(at(19, 14, 10), 'Delivery attempt: exception · address confirmation required', 'fail')],
        { facts: { delivery: 'Exception' }, excludes: ['del-progress', 'del-addr', 'del-unavail', 'del-complete'] }),
      C('del-addr', 'Order not shipped: address validation failed', 'blocker',
        r => [F('Address validation failed: unit number missing', `${r.identifier} · Address validation: Failed · No shipment event`, 'The order was not released for shipment because the address did not pass validation. This is not a delivery failure; the card has not shipped.', ['Get the unit number from the customer now.', '^Correct the address on the order so it ships.'], 'Your card has not shipped yet because the address on the order needs a unit number. Once it is corrected, the order can move forward.')],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(tsOf(r.date) + 10, 'Address validation failed · unit number missing', 'fail', true)],
        { facts: { delivery: 'Not shipped' }, excludes: ['del-progress', 'del-delayed', 'del-exception', 'del-unavail', 'del-complete'], done: r => [`Submitted the card order ${r.date} · address failed validation`] }),
      C('del-unavail', 'Tracking information unavailable', 'unknown',
        r => [F('Unable to determine delivery status', `${r.identifier} · Shipped · No tracking events available`, 'The order shows it shipped, but no tracking events are available, so its current state cannot be established.', ['Tell the customer you are tracking down the shipment status.', '^Get the last tracking event from the shipment record before giving a date.'], 'We are checking the latest status of your card shipment and will confirm what we find.')],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(tsOf(r.shipped), 'Card shipped · no tracking events since', 'info', true)],
        { facts: { delivery: 'Tracking unavailable' }, excludes: ['del-progress', 'del-delayed', 'del-exception', 'del-addr', 'del-complete'] }),
      C('del-complete', 'No blocker: delivery completed', 'clear',
        r => [F('Delivery completed', `${r.identifier} · Delivered ${r.delivered} · Receipt confirmed`, 'A delivery confirmation is recorded, so delivery is not what is holding the card up.', ['Ask the customer to check with others at the address, since delivery was confirmed.|checkmail', '^Reissue the card if it still cannot be found.|maybe-reissue'], `Our records show the card was delivered on ${r.delivered.replace(', 2026', '')}. Could you check with anyone at your address who may have received it?`)],
        r => [E(tsOf(r.date), 'Card order submitted', 'info', true), E(tsOf(r.shipped), 'Card shipped', 'ok', true), E(tsOf(r.delivered) + 245, 'Delivered · receipt confirmed', 'ok')],
        { exclusive: true, facts: { delivery: 'Delivered' }, done: r => [`Card delivered ${r.delivered} · receipt confirmed`] }),
      C('del-checked', 'Case note: customer already checked household and building', 'blocker',
        r => [F('Delivered, but the customer cannot find the card', `${r.identifier} · Delivered ${r.delivered} · Customer has already checked household and building`, 'Delivery is confirmed and the customer has already ruled out the household and building, so the card is lost or misdelivered.', ['^Reissue the card. The customer has already ruled out the household and building.'], 'Since the original card cannot be found, we will arrange a replacement for you.')],
        r => [E(at(21, 9, 10), 'Case note · customer checked household and building; card not found', 'info')],
        { needs: ['del-complete'], needsLabel: 'Delivery completed', note: { date: 'Oct 21, 2026 · 9:10 AM', channel: 'Phone', text: 'customer checked household and building; card not found' },
          done: () => ['Checked with household and building; card not found (case note)'], skip: ['checkmail', 'address', 'maybe-reissue'] })
    ],
    replacement: [
      C('rep-pending', 'Requested; no fulfillment event yet', 'info',
        r => [F('Replacement requested; no fulfillment event recorded', `${r.identifier} · Address validated · No fulfillment event on record`, 'The request is open and passed address validation, but no fulfillment has been recorded. No address or delivery failure is on record.', ['Tell the customer the request is processing and has not failed.', 'Do not submit a duplicate request.'], 'Your replacement has been requested and is still being processed. It has not shipped yet.')],
        r => [E(tsOf(r.date), 'Replacement requested', 'info', true), E(tsOf(r.date) + 5, 'Address validated', 'ok', true)],
        { excludes: ['rep-address', 'rep-complete', 'rep-unclear'], done: r => [`Submitted the replacement request ${r.date}`], skip: ['resubmit'] }),
      C('rep-address', 'Blocked: address validation failed', 'blocker',
        r => [F('Replacement blocked: address validation failed', `${r.identifier} · Address validation: Failed (unit number missing) · No fulfillment`, 'The replacement order cannot be released until a valid address is on the request. Nothing has been fulfilled.', ['Get the unit number from the customer now.', '^Resubmit the corrected address on the request.'], 'We could not ship your replacement because the address needs a unit number. Once it is corrected we can continue.')],
        r => [E(tsOf(r.date), 'Replacement requested', 'info', true), E(tsOf(r.date) + 4, 'Address submitted · validation failed (unit number missing)', 'fail', true)],
        { excludes: ['rep-pending', 'rep-complete', 'rep-mismatch'], done: r => [`Submitted the replacement request ${r.date} · address failed validation`], skip: ['resubmit'] }),
      C('rep-mismatch', 'Blocked: request lists a different card', 'blocker',
        r => [F('Card on the request does not match the reported card', `${r.identifier} lists card ending ${r.card} · Customer is reporting card ending ${r.otherCard}`, 'The request is linked to a different card than the one the customer is reporting, so the replacement could be for the wrong card.', ['Confirm with the customer which card needs replacing.', '^Correct the card on the request.'], 'We need to confirm which card the replacement is for before we can continue.')],
        r => [E(tsOf(r.date), 'Replacement requested', 'info', true)], { excludes: ['rep-pending', 'rep-complete', 'rep-address'] }),
      C('rep-unclear', 'Reason or eligibility not recorded', 'unknown',
        r => [F('Unable to determine replacement reason or eligibility', `${r.identifier} · No loss, damage or order reason recorded`, 'The request has no recorded reason, so eligibility cannot be established.', ['Ask the customer why the card needs replacing (lost, damaged or other).', '^Record the reason on the request before it proceeds.'], 'To continue your replacement we need to confirm why the card needs replacing.')],
        r => [E(tsOf(r.date), 'Replacement requested · no reason recorded', 'info', true)], { excludes: ['rep-pending', 'rep-complete'] }),
      C('rep-complete', 'Fulfilled and delivered', 'clear',
        r => [F('Replacement completed', `${r.identifier} · Fulfilled ${r.fulfilled} · Delivery confirmed ${r.delivered}`, 'The replacement was fulfilled and delivery was confirmed.', ['Guide the customer to activate the new card.'], 'Your replacement card was delivered. It needs to be activated before you can use it.')],
        r => [E(tsOf(r.date), 'Replacement requested', 'info', true), E(tsOf(r.fulfilled), 'Replacement fulfilled', 'ok', true), E(tsOf(r.delivered), 'Delivered · receipt confirmed', 'ok', true)],
        { excludes: ['rep-pending', 'rep-address', 'rep-mismatch', 'rep-unclear'], done: r => [`Requested ${r.date} and received the replacement ${r.delivered}`] }),
      C('rep-clear', 'No blocker recorded on the request', 'clear',
        r => [F('No replacement blocker detected', `${r.identifier} · Card ending ${r.card} · No error, hold or mismatch recorded`, 'The request has no recorded error, hold or card mismatch.', ['Tell the customer the request is received. Nothing else is needed.'], 'Your replacement request has been received. We will let you know if anything more is needed.')],
        r => [E(tsOf(r.date), 'Replacement requested', 'info', true)], { exclusive: true, done: r => [`Requested the replacement ${r.date}`] }),
      NOTE('rep-prior', 'Case note: customer already submitted this request once', ['rep-pending', 'rep-address'],
        { when: r => tsOf(r.date) + 60, date: 'Oct 12, 2026 · 10:00 AM', channel: 'Chat', text: 'customer says they already submitted this replacement request' },
        { done: () => ['Already submitted the replacement request (case note)'], skip: ['resubmit'] })
    ],
    notworking: [
      C('nw-suspended', 'Card suspended', 'blocker', r => [suspFinding(r, 'A suspended card cannot complete payments.')],
        r => [E(SUSP, 'Card status changed to Suspended', 'fail')], { facts: { cardStatus: 'Suspended' }, excludes: ['nw-contactless'], skip: ['retry', 'terminal'] }),
      C('nw-txn', 'Payment attempt declined', 'blocker',
        r => [F(`Payment attempt declined: ${r.attempt}`, `${r.attempt} · ${r.attemptWhen} · Declined`, 'The failure is specific to this attempt; no card-wide issue is recorded by this check.', [`Run the Declined transaction diagnostic for ${r.attempt} to get the decline reason.`, 'Ask the customer to try another terminal.|terminal'], 'That payment did not go through. We are checking the details of that attempt.')],
        r => [E(tsOf(r.attemptWhen), `${r.attempt} · payment declined`, 'fail')], { excludes: ['nw-chip', 'nw-contactless', 'nw-unknown'], done: r => [`Attempted payment ${r.attempt} · declined`] }),
      C('nw-chip', 'Chip read error on the attempt', 'blocker',
        r => [F(`Chip read error on ${r.attempt}`, `${r.attempt} · ${r.attemptWhen} · Chip read error`, 'The attempt was recorded as a chip read error, not a decline, so the account is not the cause.', ['Ask the customer to try tap or swipe at another terminal.|terminal', '^Mark the chip as faulty and order a replacement card.'], 'The chip could not be read at the terminal during that payment. We are arranging a replacement card.')],
        r => [E(tsOf(r.attemptWhen), `${r.attempt} · chip payment failed · chip read error`, 'fail')], { excludes: ['nw-txn', 'nw-unknown'], done: r => [`Attempted a chip payment ${r.attemptWhen} · chip read error`] }),
      C('nw-restriction', 'Card control: international use off', 'blocker',
        r => [F('Card restriction: International use disabled', `Card ending ${r.card} · Card control: International use off`, 'The control blocks use outside the customer country, which can explain a failed overseas payment.', ['Ask the customer to turn international use on in card controls if they are paying abroad.'], 'International use is turned off in your card controls. If you are paying abroad, you can turn it on in the app.')],
        r => [E(tsOf(r.attemptWhen) - D, 'International use turned off in card controls', 'info')], {}),
      C('nw-locked', 'Card locked', 'blocker', r => [lockedFinding(r)], r => [E(tsOf(r.attemptWhen) - 30, 'Card locked in card controls', 'info')], { hidden: true, facts: { cardStatus: 'Locked' } }),
      C('nw-hold', 'Account hold', 'blocker', r => [holdFinding(r)], r => [], { hidden: true, facts: { hold: 'yes' }, skip: ['retry', 'terminal'] }),
      C('nw-risk', 'Risk indicator', 'blocker', (r, w) => [riskFinding(r, w, 'coincides with the reported failure')], r => [], { hidden: true, skip: ['retry', 'terminal'] }),
      C('nw-contactless', 'Contactless retry approved', 'info',
        r => [F('Contactless payment approved', `${r.attempt} followed by an approved contactless payment`, 'A contactless payment was approved right after, so the card can complete payments.', ['Confirm the card works by contactless. If the chip keeps failing, ^order a replacement card.'.replace('^', '')], 'A contactless payment worked right after, so the card can complete payments.')],
        r => [E(tsOf(r.attemptWhen) + 2, 'Contactless payment approved', 'ok')], { facts: { cardStatus: 'Active', risk: 'none', hold: 'none' }, excludes: ['nw-suspended', 'nw-txn', 'nw-unknown'], done: () => ['Contactless payment approved right after the failed attempt'] }),
      C('nw-unknown', 'No attempt details recorded', 'unknown',
        r => [F('Unable to determine the cause: attempt details unavailable', `Card ending ${r.card} · No attempt event confirms the symptom or reason`, 'The record does not show what was attempted or how it failed.', ['Ask the customer for the merchant, amount and time of the failed attempt, and note it.', 'Match it to a transaction with the Declined transaction diagnostic.'], 'Can you share the merchant, amount and time of the payment that failed? That will help us find it.')],
        r => [], { excludes: ['nw-txn', 'nw-chip', 'nw-contactless'] }),
      C('nw-clear', 'No blocker: latest attempt approved', 'clear',
        r => [F('No current issue detected', `${r.attempt} · ${r.attemptWhen} · Approved`, 'The most recent attempt was approved and no card status or restriction issue is recorded.', ['Ask the customer when and where it failed. Their latest attempt was approved.'], 'Your most recent card payment went through. Can you tell us when and where the problem happened?')],
        r => [E(tsOf(r.attemptWhen), `${r.attempt} · payment approved`, 'ok')], { exclusive: true, done: r => [`Latest attempt ${r.attempt} was approved`] }),
      NOTE('nw-tried', 'Case note: customer already tried chip, tap and another terminal', ['nw-chip', 'nw-txn'],
        { when: r => tsOf(r.attemptWhen) + 25, date: 'Oct 19, 2026 · 6:40 PM', channel: 'Chat', text: 'customer tried chip, tap and a second terminal; all failed' },
        { done: () => ['Tried chip, tap and a second terminal; all failed (case note)'], skip: ['terminal', 'retry'] })
    ],
    restrictions: [
      C('res-detected', 'Card locked in card controls', 'blocker',
        r => [F('Restriction: card locked in card controls', `Control event ${r.control} · ${r.controlWhen}`, 'The lock explains declined payments after that time.', ['Ask the customer to unlock the card in card controls, then make one new payment.'], 'Your card is locked in its controls, which is why payments are being declined. You can unlock it in the app.')],
        r => [E(tsOf(r.controlWhen), `Card locked in card controls (${r.control})`, 'fail'), E(tsOf(r.controlWhen) + 9, 'Payment attempt declined while locked', 'fail')],
        { facts: { cardStatus: 'Locked' }, excludes: ['res-multiple', 'res-unavail', 'res-lifted'], done: () => ['Attempted a payment while the card was locked · declined'] }),
      C('res-verify', 'Restriction needs verification', 'blocker',
        r => [F('Restriction requires verification', `Control event ${r.control} · Verification requested · Not completed`, 'The restriction stays in place until the requested verification is completed.', ['Verify the customer’s identity with them now.|verify', '^Record the verification result on the control event.'], 'We need to verify a few details before this restriction can be lifted.')],
        r => [E(tsOf(r.controlWhen) + 3, 'Verification requested · not completed', 'fail')], { excludes: ['res-unavail', 'res-lifted'] }),
      C('res-multiple', 'Multiple restrictions (lock and account hold)', 'blocker',
        r => [F('Restriction: card locked in card controls', `Control event ${r.control} · ${r.controlWhen}`, 'The lock explains declined payments after that time.', ['Ask the customer to unlock the card in card controls, then make one new payment.'], 'Your card is locked in its controls, which is why payments are being declined. You can unlock it in the app.'),
                holdFinding(r)],
        r => [E(tsOf(r.controlWhen), `Card locked in card controls (${r.control})`, 'fail'), E(tsOf(r.controlWhen) + 20, 'Account hold recorded', 'fail')],
        { facts: { cardStatus: 'Locked', hold: 'yes' }, excludes: ['res-detected', 'res-unavail', 'res-lifted', 'res-hold'], skip: ['retry'] }),
      C('res-suspended', 'Card suspended', 'blocker', r => [suspFinding(r, 'A suspended card is restricted from payments until that status changes.')], r => [E(SUSP, 'Card status changed to Suspended', 'fail')], { hidden: true, facts: { cardStatus: 'Suspended' } }),
      C('res-hold', 'Account hold', 'blocker', r => [holdFinding(r)], r => [E(tsOf(r.controlWhen) + 20, 'Account hold recorded', 'fail')], { hidden: true, facts: { hold: 'yes' } }),
      C('res-risk', 'Risk indicator', 'blocker', (r, w) => [riskFinding(r, w, 'restricts activity on the card')], r => [], { hidden: true }),
      C('res-unavail', 'Restriction status unavailable', 'unknown',
        r => [F('Unable to determine restriction status', `Card ending ${r.card} · Restriction source event not available`, 'The record does not show whether a restriction exists or what caused it.', ['Tell the customer you are confirming their card controls.', '^Get the restriction source from the card control history before advising.'], 'We are checking your card controls and will confirm what we find.')],
        r => [], { excludes: ['res-detected', 'res-verify', 'res-multiple', 'res-lifted'] }),
      C('res-lifted', 'Locked earlier, lock since removed', 'clear',
        r => [F('Restriction lifted', `Control event ${r.control} · Lock removed`, 'The lock was removed, so no restriction is currently recorded. Declines during the lock window are explained by it.', ['Tell the customer the lock is off and payments should work. If one still fails, run the Declined transaction diagnostic on it.'], 'The lock on your card has been removed. Payments should work again; let us know if they do not.')],
        r => [E(tsOf(r.controlWhen), `Card locked in card controls (${r.control})`, 'fail'), E(tsOf(r.controlWhen) + 5, 'Payment attempt declined while locked', 'fail'), E(tsOf(r.controlWhen) + 30, 'Card unlocked in card controls', 'ok')],
        { facts: { cardStatus: 'Active' }, excludes: ['res-detected', 'res-verify', 'res-multiple', 'res-unavail'], done: () => ['Unlocked the card in card controls'], skip: ['unlock'] }),
      C('res-clear', 'No restriction recorded', 'clear',
        r => [F('No restriction detected', `Card ending ${r.card} · Active · unlocked · No restriction indicator`, 'No lock, hold or verification requirement is recorded for this card.', ['Ask the customer for the payment that failed, then run the Declined transaction or Card not working diagnostic on it.'], 'We do not see a restriction on your card. Can you tell us about the payment that failed?')],
        r => [], { exclusive: true, done: r => [`Card ending ${r.card} is active and unlocked`] })
    ]
  };

  /* Which condition in each concern surfaces a shared account fact ("key:value" or "key:*"). */
  const IMPLIED = {
    activation:   { 'cardStatus:Suspended': 'act-suspended', 'risk:Denylisted': 'act-denylist', 'risk:Suspected fraud': 'act-fraud', 'delivery:*': 'act-notreceived' },
    decline:      { 'cardStatus:Suspended': 'dec-suspended', 'cardStatus:Locked': 'dec-card', 'hold:yes': 'dec-restriction', 'risk:Suspected fraud': 'dec-fraud', 'risk:Denylisted': 'dec-denylist' },
    notworking:   { 'cardStatus:Suspended': 'nw-suspended', 'cardStatus:Locked': 'nw-locked', 'hold:yes': 'nw-hold', 'risk:*': 'nw-risk' },
    restrictions: { 'cardStatus:Suspended': 'res-suspended', 'cardStatus:Locked': 'res-detected', 'hold:yes': 'res-hold', 'risk:*': 'res-risk' }
  };
  const SKIP_LABELS = { retry: 'Retrying the same attempt', reinstall: 'App update, reinstall or restart', terminal: 'Trying another terminal or entry method', checkmail: 'Asking them to check with household or building', address: 'Re-confirming the address', resubmit: 'Submitting another request', verify: 'Re-verifying identity', unlock: 'Unlocking the card again' };

  const byId = (issue, id) => lib[issue].find(c => c.id === id);
  const defaultClear = issue => lib[issue].find(c => c.exclusive);
  const visible = issue => lib[issue].filter(c => !c.hidden);

  /* Shared account facts from every applied condition in every concern. */
  function world(config) {
    const w = { cardStatus: null, risk: null, hold: null, delivery: null, balanceLow: null };
    for (const issue of Object.keys(lib)) for (const id of config[issue] || []) Object.assign(w, byId(issue, id)?.facts || {});
    return w;
  }
  /* Contact-history rows contributed by applied case-note conditions. */
  function notes(config) {
    const out = [];
    for (const issue of Object.keys(lib)) for (const id of config[issue] || []) { const n = byId(issue, id)?.note; if (n) out.push({ date: n.date, channel: n.channel, text: n.text.charAt(0).toUpperCase() + n.text.slice(1) }); }
    return out.sort((a, b) => tsOf(b.date) - tsOf(a.date));
  }

  /* Why `id` (in `issue`) cannot be added to the draft config: a conflicting or missing condition, else null. */
  function conflictDraft(config, issue, id) {
    const c = byId(issue, id), mine = config[issue] || [];
    for (const sid of mine) {
      if (sid === id) continue;
      const s = byId(issue, sid);
      if (s.excludes.includes(id) || c.excludes.includes(sid) || ((s.exclusive || c.exclusive) && !s.note && !c.note)) return { cond: s, issue };
    }
    for (const other of Object.keys(lib)) for (const sid of config[other] || []) {
      if (other === issue && sid === id) continue;
      const s = byId(other, sid);
      for (const k of Object.keys(c.facts)) if (k in s.facts && s.facts[k] !== c.facts[k]) return { cond: s, issue: other, fact: k };
    }
    if (c.needs.length && !c.needs.some(n => mine.includes(n))) return { needs: c.needsLabel || 'another condition' };
    return null;
  }
  function isValid(config) {
    return Object.keys(config).every(issue => (config[issue] || []).every(id => byId(issue, id) && !conflictDraft({ ...config, [issue]: config[issue].filter(x => x !== id) }, issue, id)));
  }
  /* Remove conditions whose prerequisites were deselected. */
  function prune(config) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const issue of Object.keys(config)) for (const id of [...config[issue]]) { const c = byId(issue, id); if (c.needs.length && !c.needs.some(n => config[issue].includes(n))) { config[issue] = config[issue].filter(x => x !== id); changed = true; } }
    }
    return config;
  }

  const uniq = a => [...new Set(a.filter(Boolean))];
  const clock = ev => {
    if (ev.label) return ev.label;
    const d = Math.floor(ev.ts / D), m = ev.ts % D, h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
    return ev.dateOnly ? `Oct ${d}` : `Oct ${d} · ${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
  };
  const parseAction = s => { const ext = s.startsWith('^'); const [text, tag] = (ext ? s.slice(1) : s).split('|'); return { text, ext, tag }; };

  function evaluate(issue, record, selected, w) {
    w = w || {};
    const own = selected || [];
    const ownKeys = new Set(own.flatMap(id => Object.keys(byId(issue, id).facts)));
    const implied = [];
    for (const [k, v] of Object.entries(w)) {
      if (!v || ownKeys.has(k)) continue;
      const m = IMPLIED[issue]; if (!m) continue;
      const id = m[`${k}:${v}`] || ((k === 'risk' && v !== 'none') || (k === 'delivery' && v !== 'Delivered') ? m[`${k}:*`] : null);
      if (id && !own.includes(id)) implied.push(id);
    }
    let ids = [...own, ...implied];
    if (!ids.length) ids = [defaultClear(issue).id];
    const findings = [], events = [], done = [], noteActions = [], skip = new Set(), seenF = new Set(), seenE = new Set();
    const addEv = ev => { const k = ev.ts + ev.text; if (!seenE.has(k)) { seenE.add(k); events.push(ev); } };
    for (const id of ids) {
      const c = byId(issue, id);
      for (const f of c.findings(record, w)) if (!seenF.has(f.title)) { seenF.add(f.title); findings.push({ ...f, kind: c.kind, id: c.id }); }
      c.events(record, w).forEach(addEv);
      c.done(record, w).forEach(d => done.push(d));
      c.skip.forEach(t => skip.add(t));
      if (c.note?.actions) noteActions.push(...c.note.actions);
    }
    if (issue === 'decline') {            /* one recorded decline reason: the highest-precedence cause */
      const conds = ids.map(id => byId(issue, id)), reasons = conds.filter(c => c.reason).map(c => c.reason);
      if (reasons.length || ids.includes('dec-retry')) {
        const recorded = own.includes('dec-unavail') ? { text: 'reason not recorded' } : reasons.sort((a, b) => a.rank - b.rank)[0];
        addEv(E(tsOf(record.date), `${record.label} purchase of ${record.amount} declined${recorded ? ' · ' + recorded.text : ''}`, 'fail'));
      }
    }
    events.sort((a, b) => a.ts - b.ts);
    const of = k => findings.filter(f => f.kind === k);
    const blockers = of('blocker'), unknowns = of('unknown'), infos = of('info'), clears = of('clear');
    const primary = blockers[0] || unknowns[0] || infos[0] || clears[0];
    const status = blockers.length > 1 ? 'Multiple Blockers Detected' : blockers.length === 1 ? 'Action Required' : unknowns.length ? 'Unable to Determine' : 'No Blocker Detected';
    const tone = blockers.length ? 'blocker' : unknowns.length ? 'unknown' : 'clear';
    const acts = fs => uniq(fs.flatMap(f => f.actions));
    let raw, why, customer;
    if (tone === 'blocker') {
      raw = uniq([...noteActions, ...acts(blockers).slice(0, 4), ...acts(unknowns).slice(0, 2), ...acts(infos).slice(0, 1)]);
      why = uniq([...blockers.slice(0, 2).map(f => f.why), ...unknowns.slice(0, 1).map(f => f.why)]);
      customer = uniq([...blockers.map(f => f.customer), ...unknowns.map(f => f.customer)]).slice(0, 2);
    } else if (tone === 'unknown') {
      raw = uniq([...noteActions, ...acts(unknowns), ...acts(infos)]);
      why = uniq(unknowns.map(f => f.why)).slice(0, 2);
      customer = uniq(unknowns.map(f => f.customer)).slice(0, 2);
    } else {
      raw = uniq([...noteActions, ...acts(infos), ...acts(clears)]);
      why = uniq([...infos, ...clears].slice(0, 2).map(f => f.why));
      customer = uniq([...infos, ...clears].map(f => f.customer)).slice(0, 2);
    }
    const actions = raw.map(parseAction).filter(a => !(a.tag && skip.has(a.tag))).slice(0, 5).map(({ text, ext }) => ({ text, ext }));
    return {
      status, tone, primary, blockers, questions: unknowns,
      why, actions, customer,
      done: uniq(done).slice(0, 5),
      skip: uniq([...skip].map(t => SKIP_LABELS[t])),
      sensitive: findings.some(f => f.sensitive),
      timeline: events.map(ev => ({ when: clock(ev), text: ev.text, res: ev.res })),
      evidence: findings.map(f => ({ title: f.title, evidence: f.evidence, kind: f.kind }))
    };
  }

  window.NorthstarConditions = { lib, byId, visible, conflictDraft, isValid, prune, evaluate, world, notes, defaultClear, tsOf };
})();

