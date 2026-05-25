<div class="flex items-center justify-center h-screen">
	<div class="text-center">
		<div class="floating-sphere mx-auto mb-6"></div>
		<p class="text-sm text-text-secondary">select a project or create one</p>
	</div>
</div>

<style>
	.floating-sphere {
		width: 40px;
		height: 40px;
		background: var(--color-text);
		border-radius: 50%;
		opacity: 0.08;
		animation: floatBreathe 3s ease-in-out infinite;
	}
	@keyframes floatBreathe {
		0%, 100% { transform: translateY(0); opacity: 0.08; }
		50% { transform: translateY(-8px); opacity: 0.15; }
	}
</style>
