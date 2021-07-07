import React, { useMemo } from 'react'
import { useSelector, shallowEqual } from 'react-redux'

const Layer = ({layerId, preAPI}) => {

	const Element = useSelector(state => state.elements[state.layers[layerId].element])
	const effectiveInputs = useSelector(state => state.layers[layerId].effectiveInputs)
	const children = useSelector(state => state.layers[layerId].children)

	const inheritedChildren = useSelector(state => state.layers[layerId].inheritedChildren.map(
		srcLayerId => state.layers[layerId].inheritedChildrenMap[srcLayerId]
	), shallowEqual)

	const api = useMemo(() => preAPI.getLayerAPI(layerId), [layerId, preAPI])

	return (
		<Element
			api={api}
			{...effectiveInputs}		
		>

			{inheritedChildren.map(childId => <Layer
				preAPI={preAPI}
				layerId={childId}
				key={childId}
			/>)}

			{children.map(childId => <Layer
				preAPI={preAPI}
				layerId={childId}
				key={childId}
			/>)}
			
		</Element>
	)

}

export default Layer
