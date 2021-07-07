import React, { useMemo } from 'react'
import { useDispatch } from 'react-redux'
import { useGlobalState } from './helpers'

import Layer from './Layer'
import { getPreAPI } from './API'

const Combine = ({ entrypoint, inject }) => {
	const dispatch = useDispatch()
	const globalState = useGlobalState()
	const preAPI = useMemo(() => getPreAPI(globalState, inject, dispatch), [entrypoint, inject])

	return <Layer preAPI={preAPI} layerId={entrypoint} />
}

export default Combine