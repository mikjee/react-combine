import reducerMap from './reducers'
import Combine from './Combine'
import applyEnhancers from './applyEnhancers'
import { canParent } from './core'
import { getUserAPI } from './API.js'

export default Combine
export {
	applyEnhancers,
	reducerMap,
	canParent,
	getUserAPI
}