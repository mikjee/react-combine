import reducerMap from './src/redux/reducers'
import applyEnhancers from './src/redux/applyEnhancers'

import Combine from './src/components/Combine'

import { canParent } from './src/framework/core'
import { getUserAPI } from './src/framework/API'

export default Combine

export {
	applyEnhancers,
	reducerMap,
	canParent,
	getUserAPI
}