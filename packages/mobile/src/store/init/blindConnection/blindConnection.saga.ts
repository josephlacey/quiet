import { select, put } from 'typed-redux-saga'
import { initSelectors } from '../init.selectors'
import { initActions } from '../init.slice'

export function* blindConnectionSaga(): Generator {
  const lastKnownSocketIOData = yield* select(initSelectors.lastKnownSocketIOData)
  yield* put(initActions.startWebsocketConnection(lastKnownSocketIOData))
}
