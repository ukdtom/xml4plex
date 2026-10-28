class QueueElement {
    constructor(value) {
        this.value = value;
        this.behind = null;
    }
}

export class QueueDwn {
    constructor() {
        this.front = null;
        this.back = null;
        this.size = 0;
    }

    enqueue(val) {
        const newQueueElement = new QueueElement(val);
        if (!this.front) {
            this.front = newQueueElement;
            this.back = newQueueElement;
        } else {
            const prevBack = this.back;
            prevBack.behind = newQueueElement;
            this.back = newQueueElement;
        }
        this.size = this.size +1;
        console.log("Ged 93 queue", JSON.parse(JSON.stringify(this)))
        return this.size;
    }

    dequeue() {
        if (!this.front) {
            return null;
        }
        const prevFront = this.front;
        if (this.front === this.back) {
            this.front = null;
            this.back = null;
        } else {
            this.front = this.front.behind;
        }
        this.size = this.size -1
        return prevFront.value;
    }
}