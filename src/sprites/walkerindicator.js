const WALKER_INDICATOR_COLOR = 0xFFFFFF

export class WalkerIndicator {
    /**
     * @returns {PIXI.Graphics}
     */
    make_indicator_sprite() {
        const sprite = new PIXI.Graphics
        sprite.beginFill(WALKER_INDICATOR_COLOR)
        sprite.drawCircle(0, 0, 30, 30)
        sprite.endFill()
        sprite.zIndex = -20
        return sprite
    }

    update_indicator_sprite() {
        const radius = 1/(0.1+(this.current_frame/this.frame_required))
        this.sprite.clear()
        this.sprite.beginFill(WALKER_INDICATOR_COLOR)
        this.sprite.drawCircle(0, 0, radius, radius)
        this.sprite.endFill()
    }

    /**
     * @param {PIXI.Container} stage 
     */
    constructor(stage,target,frame_required) {
        this.stage = stage
        this.target = target
        this.frame_required = frame_required
        this.in_stage = false
        this.current_frame = 0
    }

    remove() {
        this.stage.removeChild(this.sprite)
        this.sprite.destroy()
        this.in_stage = false
    }

    /**
     * @param {PIXI.Point} screen_position
     */
    update(screen_position,distance) {
        if (!this.in_stage) {
            this.in_stage = true
            this.sprite = this.make_indicator_sprite()
            this.stage.addChild(this.sprite)
        }
        this.update_indicator_sprite()
        this.current_frame = this.current_frame + 1
        this.sprite.position = screen_position
        this.distance = distance
    }
}
