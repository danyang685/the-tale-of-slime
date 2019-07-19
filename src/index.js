import * as PIXI from 'pixi.js'
import { HeroWalker, Background, Ground, Hero, WalkerIndicator, Bullet, Slime, BulletIndicator, Flipflops, Tower } from './sprites'
import { WIDTH, HEIGHT } from './common'
import $ from 'jquery'

let type = "WebGL"
if (!PIXI.utils.isWebGLSupported()) {
    type = "canvas"
}

PIXI.utils.sayHello(type)

let app = new PIXI.Application({ width: WIDTH, height: HEIGHT, backgroundColor: 0xFFFFFF })

document.body.appendChild(app.view)

class Game {

    /**
     * @param {PIXI.Container} stage
     */
    constructor(stage) {
        this.stage = stage
        this.stage.sortableChildren = true

        // Background
        this.background = new Background(stage)

        // Hero
        this.hero_location = new PIXI.Point(0, 0)
        this.hero = new Hero(stage)
        this.hero_walker = null
        this.walker_indicator = null
        this.move_disabled = false

        // Bullets
        this.bullets = []
        this.shoot = false
        this.weapon_type = 0
        this.mouse_pos = new PIXI.Point(0, 0)

        // Skills
        this.skill_zen_mode = false
        this.skill_power_mode = false

        // Slimes
        this.slimes = []

        // Ground
        this.ground = new Ground(stage)

        // Tower
        this.place_tower_mode = false
        this.towers = []

        // Camera
        this.camera_center = new PIXI.Point(0, 0)
        this.screen_center = new PIXI.Point(WIDTH / 2, HEIGHT / 2)

        // Events
        stage.interactive = true
        stage.on('mousedown', e => this.on_click(e))
        stage.on('mousemove', e => this.on_mousemove(e))
        $(document).on('keydown', e => this.on_keydown(e))
        $(document).on('keyup', e => this.on_keyup(e))

        // Animations
        this.animations = []

        // Others
        this.flip_flops = new Flipflops(this.stage)

        // Basics
        this.current_frame = 0
    }

    /**
     * @param {PIXI.Point} map_position
     * @returns {PIXI.Point}
     */
    transform_to_screen_space(map_position) {
        return new PIXI.Point(
            map_position.x - this.camera_center.x + this.screen_center.x,
            map_position.y - this.camera_center.y + this.screen_center.y)
    }

    /**
     * @param {PIXI.Point} screen_position
     * @returns {PIXI.Point}
     */
    transform_to_map_space(screen_position) {
        return new PIXI.Point(
            screen_position.x + this.camera_center.x - this.screen_center.x,
            screen_position.y + this.camera_center.y - this.screen_center.y)
    }

    update_hero() {
        const screen_position = this.transform_to_screen_space(this.hero_location)
        this.hero.update(screen_position)
        if (this.hero_walker) {
            this.hero_location = this.hero_walker.next_position()
            this.camera_center = this.hero_location
            if (this.walker_indicator == null) {
                this.walker_indicator = new WalkerIndicator(this.stage)
            }
            this.walker_indicator.update(this.transform_to_screen_space(this.hero_walker.target_position))
            if (this.hero_walker.end()) {
                this.hero_walker = null
                this.walker_indicator.remove()
                this.walker_indicator = null
            }
        }
    }

    update_ground() {
        const screen_position = this.transform_to_screen_space(new PIXI.Point(0, 0))
        this.ground.update(screen_position)
    }

    /**
     * @param {PIXI.Point} from 
     * @param {PIXI.Point} to 
     * @param {Number} speed 
     * @returns {PIXI.Point}
     */
    get_vector(from, to, speed, fix) {
        const dx = to.x - from.x
        const dy = to.y - from.y
        const r = Math.sqrt(dx * dx + dy * dy)
        if (fix && r < speed) return new PIXI.Point(to.x, to.y)
        return new PIXI.Point(dx / r * speed, dy / r * speed)
    }

    /**
     * @returns {PIXI.Rectangle}
     */
    get_map_box(margin) {
        margin = margin || 0
        const left_top_corner = this.transform_to_map_space(new PIXI.Point(0, 0))
        return new PIXI.Rectangle(left_top_corner.x - margin, left_top_corner.y - margin,
            WIDTH + margin * 2, HEIGHT + margin * 2)
    }

    generate_bullet_of_type_0() {
        const sprite = new Bullet(this.stage)
        const bullet = {
            position: new PIXI.Point(this.hero_location.x, this.hero_location.y),
            velocity: this.get_vector(this.hero_location, this.transform_to_map_space(this.mouse_pos), 20),
            sprite
        }
        this.bullets.push(bullet)
    }

    generate_bullet_of_type_1() {
        const angles_deg = [-30, -15, 0, 15, 30]
        const mouse_pos = this.transform_to_map_space(this.mouse_pos)
        const zero_angle = Math.atan2(mouse_pos.y - this.hero_location.y, mouse_pos.x - this.hero_location.x)
        const speed = 20
        for (let angle of angles_deg) {
            const target_angle = zero_angle + angle / 180 * Math.PI
            const sprite = new Bullet(this.stage)
            const bullet = {
                position: new PIXI.Point(this.hero_location.x, this.hero_location.y),
                velocity: new PIXI.Point(Math.cos(target_angle) * speed, Math.sin(target_angle) * speed),
                sprite
            }
            this.bullets.push(bullet)
        }
    }

    generate_bullet_of_type_2(_speed) {
        this.__bullet_2_fi = this.__bullet_2_fi || 0
        this.__bullet_2_fi = (this.__bullet_2_fi + 15) % 360
        const angles_deg = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324]
        const mouse_pos = this.transform_to_map_space(this.mouse_pos)
        const zero_angle = Math.atan2(mouse_pos.y - this.hero_location.y, mouse_pos.x - this.hero_location.x)
        const speed = _speed || 20
        for (let angle of angles_deg) {
            const target_angle = zero_angle + (angle + this.__bullet_2_fi) / 180 * Math.PI
            const sprite = new Bullet(this.stage)
            const bullet = {
                position: new PIXI.Point(this.hero_location.x, this.hero_location.y),
                velocity: new PIXI.Point(Math.cos(target_angle) * speed, Math.sin(target_angle) * speed),
                sprite
            }
            this.bullets.push(bullet)
        }
    }

    update_bullets() {
        if (this.shoot) {
            if (this.weapon_type == 0) {
                this.generate_bullet_of_type_0()
            } else if (this.weapon_type == 1) {
                if (this.current_frame % 5 == 0 || this.skill_power_mode) this.generate_bullet_of_type_1()
            } else if (this.weapon_type == 2) {
                if (this.current_frame % 10 == 0 || this.skill_power_mode) this.generate_bullet_of_type_2()
            }
        }
        const map_box = this.get_map_box(500)
        for (let i = 0; i < this.bullets.length; i++) {
            this.bullets[i].sprite.update(this.transform_to_screen_space(this.bullets[i].position))
            this.bullets[i].position.x += this.bullets[i].velocity.x
            this.bullets[i].position.y += this.bullets[i].velocity.y
        }
        this.bullets = this.filter_out_sprites(this.bullets, map_box)
    }

    make_slime(position, radius, hp, giant) {
        const sprite = new Slime(this.stage, radius, giant)
        const slime = {
            position,
            sprite,
            acc: new PIXI.Point(0, 0),
            hp,
            max_hp: hp,
            radius
        }
        return slime
    }

    generate_slime() {
        const map_box = this.get_map_box(50)
        const location = Math.floor(Math.random() * 4)
        let position = null
        if (location == 0) {
            position = new PIXI.Point(map_box.left, map_box.top + Math.random() * map_box.height)
        } else if (location == 1) {
            position = new PIXI.Point(map_box.right, map_box.top + Math.random() * map_box.height)
        } else if (location == 2) {
            position = new PIXI.Point(map_box.left + Math.random() * map_box.width, map_box.top)
        } else if (location == 3) {
            position = new PIXI.Point(map_box.left + Math.random() * map_box.width, map_box.bottom)
        }
        const rand = Math.random()
        let radius = 0
        let giant = false
        if (rand < 0.03)  {
            giant = true
            radius = 160
        } else if (rand < 0.1) radius = 80
        else if (rand < 0.3) radius = 40
        else radius = 20
        this.slimes.push(this.make_slime(position, radius, giant ? 500 : 5, giant))
    }

    /**
     * @param {PIXI.Point} individual 
     * @param {[PIXI.Point]} others 
     * @returns {[Number]}
     */
    collision(individual, radius, others) {
        const collision_id = []
        for (let i = 0; i < others.length; i++) {
            const other = others[i]
            const dx = other.x - individual.x
            const dy = other.y - individual.y
            const dist_squared = dx * dx + dy * dy
            if (dist_squared < radius * radius) collision_id.push(i)
        }
        return collision_id
    }

    /**
     * @param {PIXI.Point} position 
     */
    make_bullet_bomb_animation(position) {
        const begin_frame = this.current_frame
        const animation = {
            sprite: new BulletIndicator(this.stage),
            end: () => this.current_frame - begin_frame >= 10,
            position
        }
        this.animations.push(animation)
    }

    /**
     * @param {PIXI.Point} position 
     * @param {Number} radius
     */
    rand_around(position, radius) {
        return new PIXI.Point(position.x + Math.random() * radius * 2 - radius, position.y + Math.random() * radius * 2 - radius)
    }

    update_slimes() {
        if (this.current_frame % 30 == 0) this.generate_slime()

        const map_box = this.get_map_box(200)
        for (let i = 0; i < this.slimes.length; i++) {
            if (map_box.contains(this.slimes[i].position.x, this.slimes[i].position.y)) {
                this.slimes[i].sprite.update(this.transform_to_screen_space(this.slimes[i].position), this.slimes[i].hp / this.slimes[i].max_hp)
            } else {
                this.slimes[i].sprite.remove()
            }
            const velocity = this.get_vector(this.slimes[i].position, this.hero_location, 2)

            velocity.x += this.slimes[i].acc.x
            velocity.y += this.slimes[i].acc.y

            const acc_reduction = this.get_vector(this.slimes[i].acc, new PIXI.Point(0, 0), 0.3, true)
            this.slimes[i].acc.x += acc_reduction.x
            this.slimes[i].acc.y += acc_reduction.y


            this.slimes[i].position.x += velocity.x
            this.slimes[i].position.y += velocity.y
        }
        const bullets_position = this.bullets.map(b => b.position)
        const new_slimes = []
        this.slimes = this.slimes.filter(slime => {
            const collision_ids = this.collision(slime.position, slime.radius, bullets_position)
            collision_ids.reverse().forEach(collision_id => {
                const ACC_RATE = 0.3 / slime.radius * 20
                slime.hp -= 1
                this.make_bullet_bomb_animation(this.bullets[collision_id].position)
                slime.acc.x += this.bullets[collision_id].velocity.x * ACC_RATE
                slime.acc.y += this.bullets[collision_id].velocity.y * ACC_RATE
                this.bullets[collision_id].sprite.remove()
                this.bullets.splice(collision_id, 1)
                bullets_position.splice(collision_id, 1)
            })
            if (slime.hp <= 0) {
                slime.sprite.remove()
                if (slime.radius > 20) {
                    for (let i = 0; i < 3; i++) {
                        const s = this.make_slime(slime.position.clone(), slime.radius / 2, 10)
                        s.acc = this.rand_around(slime.acc, 10)
                        new_slimes.push(s)
                    }
                }
                return false
            }
            return true
        })
        this.slimes = this.slimes.concat(new_slimes)
    }

    update_skills() {
        if (this.skill_zen_mode) {
            if (this.current_frame - this.__zen_mode_begin >= 180) {
                this.skill_zen_mode = false
                return
            }
            this.generate_bullet_of_type_2(7)
        }
        if (this.skill_power_mode) {
            if (this.current_frame - this.__power_mode_begin >= 180) {
                this.skill_power_mode = false
                return
            }
        }
    }

    update_animation() {
        this.animations = this.animations.filter(animation => {
            if (animation.end()) {
                animation.sprite.remove()
                return false
            }
            return true
        })
        for (let animation of this.animations) {
            animation.sprite.update(this.transform_to_screen_space(animation.position))
        }
    }

    update_others() {
        this.flip_flops.update(this.transform_to_screen_space(new PIXI.Point(-200, -200)))
    }

    filter_out_sprites(elements, map_box) {
        return elements.filter(element => {
            if (!map_box.contains(element.position.x, element.position.y)) {
                element.sprite.remove()
                return false
            }
            return true
        })
    }

    update_towers() {
        const map_box = this.get_map_box(500)
        for (let i = 0; i < this.towers.length; i++) {
            this.towers[i].sprite.update(this.transform_to_screen_space(this.towers[i].position))
        }
        this.towers = this.filter_out_sprites(this.towers, map_box)
    }

    update() {
        this.update_hero()
        this.update_ground()
        this.update_bullets()
        this.update_slimes()
        this.update_skills()
        this.update_animation()
        this.update_others()
        this.update_towers()
        this.current_frame += 1
    }

    /**
     * @param {PIXI.interaction.InteractionEvent} e 
     */
    on_click(e) {
        const target_pos = this.transform_to_map_space(e.data.global)

        if (!this.move_disabled) {
            this.hero_walker = new HeroWalker(this.hero_location, target_pos)
        }

        if (this.place_tower_mode) {
            this.place_tower_at(target_pos)
        }
    }

    /**
     * @param {PIXI.Point} target_pos 
     */
    place_tower_at(target_pos) {
        const tower = {
            position: target_pos,
            sprite: new Tower(this.stage)
        }
        this.towers.push(tower)
    }

    /**
     * @param {PIXI.interaction.InteractionEvent} e 
     */
    on_mousemove(e) {
        this.mouse_pos = e.data.global
    }

    /**
     * @param {KeyboardEvent} e 
     */
    on_keydown(e) {
        if (e.code == "ShiftLeft") {
            this.shoot = true
        }
        if (e.code == "KeyZ") {
            this.weapon_type = (this.weapon_type + 1) % 3
        }
        if (e.code == "KeyX") {
            this.skill_zen_mode = true
            this.__zen_mode_begin = this.current_frame
        }
        if (e.code == "KeyC") {
            this.skill_power_mode = true
            this.__power_mode_begin = this.current_frame
        }
        if (e.code == "KeyA") {
            this.place_tower_mode = !this.place_tower_mode
            this.move_disabled = !this.move_disabled
        }
    }

    /**
     * @param {KeyboardEvent} e 
     */
    on_keyup(e) {
        if (e.code == "ShiftLeft") {
            this.shoot = false
        }
    }
}

const game = new Game(app.stage)

function run() {
    game.update()
    window.requestAnimationFrame(run)
}

run()
