/**
 * 虚拟滚动列表构造函数
 * @param {*} el 列表挂载的节点
 * @param {*} dataSource 需要渲染的数据
 * @param {*} genItemCallback 生成每一项的回调函数
 * @param {*} options 配置项
 */
function VirtualScroll(el, dataSource, genItemCallback, options = {}) {
	if (typeof el === 'string') {
		el = document.querySelector(el);
	}

	this.el = el; // 容器元素
	this.dataSource = dataSource; // 列表数据
	this.dataLen = dataSource.length; // 数据长度
	this.genItemCallback = genItemCallback; // 生成列表DOM元素的回调函数
	this.offset = 0; // 滚动条偏移量
	this.clientAmounts = 0; // 可见区域的数据记录数

	// 默认参数配置
	this.configs = {
		itemHeight: 50,
		isDynamicHeight: false,
		bufferScale: 0,
		useFrameOptimize: false,
		isCustomScrollBar: true,
		borderRadius: 6,
		scrollthumbBarWidth: 6,
	};

	Object.assign(this.configs, { ...options }); // 合并参数
	this.setItemsPosition(this.dataLen); // 计算列表中每一个节点的累计高度
	this.createVContainer(); // 创建虚拟列表节点
	this.renderVirtualList(); // 首次渲染虚拟列表
}

VirtualScroll.prototype.setTotalHeight = function (totalHeight) {
	// 更新可显示的总记录数
	this.setClientAmounts();

	// 将总高度更新到 totalHeightContainer 节点上
	this.totalHeightContainer.style.height = `${totalHeight}px`;
};

VirtualScroll.prototype.setClientAmounts = function () {
	// 设置容器的可见虚拟节点数
	this.clientAmounts = Math.ceil(this.vListContainer.clientHeight / this.configs.itemHeight);
};

VirtualScroll.prototype.createVContainer = function () {
	const elementsTpl = `
		<div class="v-container" style="position: relative; height: 100%; overflow: hidden;">
			<div class="v-list" style="position: relative; height: 100%; overflow: auto">
				<div class="v-total-height" style="position: absolute; left: 0; right: 0; top: 0; z-index: -1; height: 1px;"></div>
				<div class="v-visible-items" style="position: absolute;	left: 0; right: 0; top: 0; z-index: 1; transform: translate3d(0px, 0px, 0px)"></div>
			</div>
		</div>
	`;

	if (this.el) {
		this.el.innerHTML = elementsTpl;
	}

	// 获取节点并缓存，后续操作需要用到
	this.vContainer = $$('.v-container');
	this.vListContainer = $$('.v-list');
	this.totalHeightContainer = $$('.v-total-height');
	this.visibleItemContainer = $$('.v-visible-items');

	// 将总高度更新到 totalHeightContainer 节点上
	const dataLen = this.dataLen;
	this.setTotalHeight(this.configs.isDynamicHeight ? this.itemsPosition[dataLen - 1].bottom : this.configs.itemHeight * dataLen);

	/**注册滚动、窗口改变事件 */
	this.bindEvents();
};

VirtualScroll.prototype.bindEvents = function () {
	/**具体事件处理 */
	const handleResizing = () => {
		this.setClientAmounts();
		this.renderVirtualList();
	};

	/**监听窗口改变大小 */
	window.addEventListener('resize', this.configs.useFrameOptimize ? throttleByFrame(handleResizing) : throttle(handleResizing));

	/**scroll事件的回调函数 */
	const updateOffset = e => {
		e.preventDefault();
		this.offset = e.target.scrollTop;

		/**更新自定义滚动条的位置 */
		if (this.configs.isCustomScrollBar && this.scrollbarContainer) {
			this.updateThumbTop(this.offset, this.totalHeightContainer.clientHeight);
		}

		/**渲染列表数据 */
		this.renderVirtualList();
	};

	/**监听dom滚动事件 */
	this.vListContainer.addEventListener('scroll', this.configs.useFrameOptimize ? throttleByFrame(updateOffset) : throttle(updateOffset));
};

VirtualScroll.prototype.loadMoreData = function (data, idx) {
	this.dataSource = data;

	const dataLen = (this.dataLen = data.length);

	/**更新总高 */
	if (this.configs.isDynamicHeight) {
		const currentItem = this.itemsPosition[idx - 1];
		this.setItemsPosition(dataLen - idx, idx, currentItem);
		this.setTotalHeight(this.itemsPosition[dataLen - 1].bottom);
	} else {
		this.setTotalHeight(dataLen * this.configs.itemHeight);
	}

	/**渲染, 如果增加数据是从最末尾开始，不需要刷新 */
	if (idx < this.renderList.length) {
		return this.renderVirtualList();
	}

	/**重新计算自定义滚动条滑块的位置 */
	const scrollbarContainer = this.scrollbarContainer;
	if (this.configs.isCustomScrollBar && scrollbarContainer) {
		const totalHeight = this.totalHeightContainer.clientHeight;
		this.updateThumbHeight(totalHeight);
		this.updateThumbTop(totalHeight);
	} else {
		const { borderRadius, scrollthumbBarWidth } = this.configs;
		this.createScrollbarContainer(scrollthumbBarWidth, borderRadius);
	}
};

VirtualScroll.prototype.setItemsPosition = function (dataLen, sIndex = 0, currItem) {
	if (!this.configs.isDynamicHeight) return;
	let index = 0;
	let top = 0;
	let bottom = 0;
	let cachedPosition = [];

	if (sIndex && currItem) {
		const { top: currTop, bottom: currBottom } = currItem;
		top = currTop;
		bottom = currBottom;
		cachedPosition = this.itemsPosition.slice(0, sIndex);
	}

	const itemsPosition = [];
	const itemHeight = this.configs.itemHeight;

	while (index < dataLen) {
		itemsPosition.push({
			index: index + sIndex,
			height: itemHeight,
			top: index * itemHeight + top,
			bottom: (index + 1) * itemHeight + bottom,
		});
		index++;
	}

	this.itemsPosition = [...cachedPosition, ...itemsPosition];
};

VirtualScroll.prototype.updateItemsPotion = function (children, sIndex) {
	/**遍历 children，获取每一个 child 的 rect -> child.getBoundingClientRect() */
	if (!children.length) return;
	[...children].forEach(chidNode => {
		const rect = chidNode.getBoundingClientRect();
		const dataLen = this.dataLen;
		const itemsPosition = this.itemsPosition;

		const { height } = rect;
		const { height: oldHeight, bottom: oldBottom } = itemsPosition[sIndex];
		const _diffVal = oldHeight - height;
		if (_diffVal) {
			itemsPosition[sIndex].height = height;
			itemsPosition[sIndex].bottom = Math.ceil(oldBottom - _diffVal);
			/**并一次更新后续的节点 */
			for (let i = sIndex + 1; i < dataLen; i++) {
				itemsPosition[i].top = itemsPosition[i - 1].bottom;
				itemsPosition[i].bottom = Math.ceil(itemsPosition[i].bottom - _diffVal);
			}
		}
		sIndex++;
	});
};

VirtualScroll.prototype.updateTotalHeight = function () {
	const dataLen = this.dataLen;
	this.totalHeightContainer.style.height = `${this.itemsPosition[dataLen - 1].bottom}px`;
};

VirtualScroll.prototype.setVisibleTranslate = function (sIndex) {
	/**根据是否处于动态高度模式来返回偏移结果 */
	const offset = this.configs.isDynamicHeight ? this.itemsPosition[sIndex].top : sIndex * this.configs.itemHeight;
	this.visibleItemContainer.style.transform = `translate3d(0px, ${offset}px, 0px)`;
};

VirtualScroll.prototype.findFirstIndex = function (offset) {
	/**二分法查找 bottom */
	return this.configs.isDynamicHeight ? binarySearch(this.itemsPosition, offset, 'bottom') : Math.floor(offset / this.configs.itemHeight);
};

VirtualScroll.prototype.findEndIndex = function (sIndex) {
	return sIndex + this.clientAmounts;
};

VirtualScroll.prototype.renderVirtualList = function () {
	/**开始渲染虚拟列表 */
	let sIndex = this.findFirstIndex(this.offset);
	let eIndex = Math.min(this.findEndIndex(sIndex), this.dataLen);

	/**检测是否有需要保留缓存区域 */
	const bufferScale = this.configs.bufferScale;
	if (this.configs.bufferScale) {
		sIndex = cacBuffer('s', sIndex, this.clientAmounts, bufferScale);
		eIndex = cacBuffer('e', eIndex, this.clientAmounts, bufferScale, this.dataLen);
	}

	/**截取可渲染的数据列表 */
	this.renderList = this.dataSource.slice(sIndex, eIndex);

	const itemRenderCallback = item => {
		const itemNode = this.genItemCallback(item);
		if (!this.configs.isDynamicHeight) {
			itemNode.style.height = this.itemHeight;
		}
		return itemNode.outerHTML;
	};

	const htmlString = this.renderList.map(itemRenderCallback).join('');
	this.visibleItemContainer.innerHTML = htmlString;

	/**如果是动态高度，需要重新计并更新 itemsPosition 的位置信息，以及 totalHeightContainer 高度 */
	if (this.configs.isDynamicHeight) {
		this.updateItemsPotion(this.visibleItemContainer.children, sIndex);
		this.updateTotalHeight();
	}

	/**设置内容的偏移量 visibleItemContainer 的 translate3d */
	this.setVisibleTranslate(sIndex);

	/**如果配置的是自定义滚动条，那么需要动态计算滑块的位置 */
	if (this.configs.isCustomScrollBar) {
		const { borderRadius, scrollthumbBarWidth } = this.configs;
		this.createScrollbarContainer(scrollthumbBarWidth, borderRadius);
		this.updateThumbHeight(this.totalHeightContainer.clientHeight);
		this.updateThumbTop(this.totalHeightContainer.clientHeight);
	}
};

/**创建自定义滚动条 */
VirtualScroll.prototype.createScrollbarContainer = function (scrollthumbBarWidth, borderRadius) {
	/**如果没有开启自定义滚动条配置项直接返回 */
	if (this.scrollbarContainer) {
		return;
	}

	const scrollbarContainer = document.createElement('div');
	scrollbarContainer.classList.add('v-scrollbar');
	scrollbarContainer.style.cssText = `
		position: absolute;
		top: 0; bottom: 0; right: 14px;
		width: ${scrollthumbBarWidth}px;
	`;

	/**创建滚动条容器滑块 */
	const scrollbarThumbContainer = document.createElement('div');
	scrollbarThumbContainer.classList.add('v-scrollbar-thumb');
	scrollbarThumbContainer.style.cssText = `
		position: absolute; left: 0; top: 0; z-index: 10;
		width: 100%; background-color: rgba(100, 100, 100, 100); opacity: 0.4;
		border-radius: ${borderRadius}px; cursor: pointer; user-select: none; transition: all 500;
	`;

	/**挂载到滚动条容器 */
	scrollbarContainer.appendChild(scrollbarThumbContainer);
	this.scrollbarContainer = scrollbarContainer;
	this.scrollbarThumbContainer = scrollbarThumbContainer;

	if (this.vContainer) {
		this.vContainer.appendChild(scrollbarContainer); // 挂载到父级
		this.updateThumbHeight(this.totalHeightContainer.clientHeight); // 设定滚动条的高度
		this.bindCustomScrollbarEvents(); // 绑定事件
	}
};

VirtualScroll.prototype.bindCustomScrollbarEvents = function () {
	/**如果有自定义滚动条，那么给自定义滚动条绑定拖拽事件 */
	let moveY = null;
	let vListContainer = null;

	/**鼠标按下回调函数 */
	const mousedownHanlder = evt => {
		moveY = evt.pageY - (parseInt(this.scrollbarThumbContainer.style.top) || 0);
		document.addEventListener('mouseup', mouseupHandler);
		document.addEventListener('mousemove', mousemoveHandler);
	};

	/**鼠标移动回调函数 */
	const mousemoveHandler = evt => {
		const totalHeight = this.totalHeightContainer.clientHeight;
		const scrollbarHeight = this.scrollbarContainer.clientHeight;
		const thumbBarHeight = this.scrollbarThumbContainer.clientHeight;
		const moveMaximumHeight = scrollbarHeight - thumbBarHeight;
		const _moveDis = evt.pageY - moveY;

		/**滑块只能在 0 ~ moveMaximumHeight 之间滑动 */
		if (_moveDis < 0 || _moveDis > moveMaximumHeight) {
			return;
		}

		/**设备自定义滚动条滑块的top值 */
		this.scrollbarThumbContainer.style.top = `${_moveDis}px`;

		/**触发容器的滚动事件 */
		if (vListContainer) {
			vListContainer.scrollTop = Math.ceil(((totalHeight - scrollbarHeight) * _moveDis) / moveMaximumHeight);
		}
	};

	/**鼠标弹起回调函数 */
	const mouseupHandler = () => {
		document.removeEventListener('mousedown', mousedownHanlder);
		document.removeEventListener('mousemove', mousemoveHandler);
	};

	if (this.scrollbarContainer) {
		vListContainer = this.scrollbarContainer.previousElementSibling;
		vListContainer.classList.add('is-custom-scrollbar');
		this.scrollbarContainer.addEventListener('mousedown', mousedownHanlder);
	}
};

VirtualScroll.prototype.updateThumbTop = function (totalHeight) {
	if (!this.scrollbarContainer) return;
	const visibleHeight = this.scrollbarContainer.clientHeight;
	const moveMaximumHeight = this.scrollbarContainer.clientHeight - this.scrollbarThumbContainer.clientHeight;
	this.scrollbarThumbContainer.style.top = `${Math.floor((this.offset * moveMaximumHeight) / (totalHeight - visibleHeight))}px`;
};

VirtualScroll.prototype.updateThumbHeight = function (totalHeight) {
	if (!this.scrollbarContainer) return;
	const visibleHeight = this.scrollbarContainer.clientHeight;
	const thumbHeight = totalHeight > visibleHeight ? Math.floor((visibleHeight * visibleHeight) / totalHeight) : null;
	if (thumbHeight === null) {
		this.scrollbarContainer.parentNode.removeChild(this.scrollbarContainer);
		this.scrollbarContainer = null;
	} else {
		this.scrollbarThumbContainer.style.height = `${thumbHeight > 150 ? thumbHeight : 150}px`;
	}
};
