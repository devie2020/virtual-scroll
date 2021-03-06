import '@/lib/faker.min.js';
import VirtualScroll from '@/lib/virtual-scroll/virtual-scroll';

setTimeout(() => {
	const dataSource = [];
	for (let i = 0; i < 10; i++) {
		dataSource.push({ index: i, value: faker.lorem.sentences() });
	}

	window.loadMoreData = function (idx) {
		// 插入的数据
		const _moreData = [];
		for (let i = 0; i < 30; i++) {
			_moreData.push({ value: faker.lorem.sentences() });
		}

		// 截取插入数据后的数据，这里需要判断是否是在最后一个元素后插入，如果是就不需要处理
		const _idx = idx + 1;
		const _len = dataSource.length; // 保存一下原数据的长度
		dataSource.splice(_idx, 0, ..._moreData);
		virtualVm.loadMoreData(dataSource, _idx);
	};

	const virtualVm = new VirtualScroll(
		'.virtual-scroll-wrapper',
		dataSource,
		(item, i) => {
			const div = document.createElement('div');
			div.classList.add('v-list-item');
			div.innerHTML = `
				<div class="v-list-item-l">
					<p><b>这是第${i}项数据</b></p>
					<p>${item.value}</p>
				</div>
				<button class="v-list-item-r" onclick="loadMoreData(${i})">加载数据</button>
			`;

			return div;
		},
		{ useFrameOptimize: true, isDynamicHeight: true, isCustomScrollBar: true },
	);
});
