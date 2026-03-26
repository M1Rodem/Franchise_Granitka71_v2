import { motion } from 'framer-motion'
import type { NotificationResponseDto } from '../types/notifications.types'
import { NotificationItem } from './NotificationItem'
import surfaceStyles from '@/shared/ui/surface.module.css'
import { formatNotificationDate } from '../utils/date'
import styles from './notifications-list.module.css'

interface Props {
  items: NotificationResponseDto[]
}

function group(items: NotificationResponseDto[]) {
  const result: Record<string, NotificationResponseDto[]> = {}

  for (const item of items) {
    const key = formatNotificationDate(item.createdAt)

    if (!result[key]) {
      result[key] = []
    }

    result[key].push(item)
  }

  return result
}

const listVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
}

export function NotificationsList({ items }: Props) {
  const grouped = group(items)

  return (
    <div>
      {Object.entries(grouped).map(([title, list]) => (
        <section key={title} className={styles.group}>
          <div className={styles.groupHeader}>
            <span className={surfaceStyles.dateGroup}>{title}</span>
          </div>

          <motion.div
            className={styles.items}
            variants={listVariants}
            initial="hidden"
            animate="show"
          >
            {list.map((item) => (
              <motion.div key={item.id} variants={itemVariants}>
                <NotificationItem notification={item} />
              </motion.div>
            ))}
          </motion.div>
        </section>
      ))}
    </div>
  )
}
