import reducerMap from './src/redux/reducers'
import applyEnhancers from './src/redux/applyEnhancers'

import Combine from './src/components/Combine'

import { 
	generateLayerId,
	createLayer,
	deleteLayer,
	mountLayer,
	setParent,
	canParent,
	reorderChildren,
	setInputs,
	getProjection,
	renameLayer
} from './src/framework/core'

import { getUserAPI } from './src/framework/API'

export default Combine

export {
	applyEnhancers,
	reducerMap,

	generateLayerId,
	createLayer,
	deleteLayer,
	mountLayer,
	setParent,
	canParent,
	reorderChildren,
	setInputs,
	getProjection,
	renameLayer,

	getUserAPI
}