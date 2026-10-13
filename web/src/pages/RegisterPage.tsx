import { Alert, Button, Center, Paper, PasswordInput, Stack, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { memo, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { normalizeError } from '@/api/client'
import { useRegister } from '@/hooks/queries/useAuth'

export const RegisterPage = memo(function RegisterPage() {
  const navigate = useNavigate()
  const register = useRegister()

  const form = useForm({
    initialValues: { name: '', email: '', password: '', password_confirmation: '' },
    validate: {
      name: (v) => (v.trim().length > 0 ? null : 'Enter your name'),
      email: (v) => (/^\S+@\S+$/.test(v) ? null : 'Enter a valid email address'),
      password: (v) => (v.length >= 8 ? null : 'Password must be at least 8 characters'),
      password_confirmation: (v, values) =>
        v === values.password ? null : 'Passwords do not match',
    },
  })

  const error = useMemo(() => (register.error ? normalizeError(register.error) : null), [register.error])

  const handleSubmit = useCallback(
    (values: { name: string; email: string; password: string; password_confirmation: string }) => {
      register.mutate(values, { onSuccess: () => navigate('/') })
    },
    [navigate, register]
  )

  return (
    <Center h="100dvh" p="md">
      <Paper withBorder p="xl" w={400} maw="100%">
        <Title order={2} mb="lg">Create an account</Title>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            {error && <Alert color="red">{error.message}</Alert>}

            <TextInput label="Name" autoComplete="name" {...form.getInputProps('name')} />
            <TextInput label="Email" autoComplete="email" {...form.getInputProps('email')} />
            <PasswordInput
              label="Password"
              autoComplete="new-password"
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Confirm password"
              autoComplete="new-password"
              {...form.getInputProps('password_confirmation')}
            />

            <Button type="submit" loading={register.isPending} fullWidth>
              Register
            </Button>

            <Button component={Link} to="/login" variant="white">
              Already have an account? Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  )
})
